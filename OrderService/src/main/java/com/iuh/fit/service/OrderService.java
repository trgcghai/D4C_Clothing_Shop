package com.iuh.fit.service;

import com.iuh.fit.client.ProductClient;
import com.iuh.fit.client.dto.BatchStockRequest;
import com.iuh.fit.client.dto.BatchStockResponse;
import com.iuh.fit.domain.dto.CreateOrderFromCheckoutRequest;
import com.iuh.fit.domain.dto.OrderResponse;
import com.iuh.fit.domain.dto.PagedResponse;
import com.iuh.fit.domain.dto.UpdateOrderStatusRequest;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.domain.entity.OrderItem;
import com.iuh.fit.domain.enums.OrderStatus;
import com.iuh.fit.exception.BadRequestException;
import com.iuh.fit.exception.ResourceNotFoundException;
import com.iuh.fit.repository.OrderRepository;
import com.iuh.fit.service.OrderEventPublisher;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final AuditService auditService;
    private final ProductClient productClient;
    private final OrderEventPublisher orderEventPublisher;
    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    public OrderService(OrderRepository orderRepository, AuditService auditService,
            ProductClient productClient,
            OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.auditService = auditService;
        this.productClient = productClient;
        this.orderEventPublisher = orderEventPublisher;
    }

    @Transactional
    public OrderResponse createOrderFromCheckout(Long userId, String email, CreateOrderFromCheckoutRequest request) {
        Order existing = orderRepository
                .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                .orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        BigDecimal calculatedTotal = calculateTotal(request.getItems());
        BigDecimal requestTotal = normalizeMoney(request.getTotalAmount());
        if (calculatedTotal.compareTo(requestTotal) != 0) {
            throw new BadRequestException(
                    "Total amount mismatch. expected=" + calculatedTotal + ", actual=" + requestTotal);
        }

        // Deduct stock BEFORE creating order
        deductStockForOrder(request.getItems());

        Order order = new Order();
        order.setUserId(userId);
        order.setCheckoutOrderId(request.getOrderId());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setTotalAmount(calculatedTotal);
        order.setPaymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : "CASH");
        order.setEmail(email);
        order.setShippingStreet(request.getShippingStreet());
        order.setShippingWard(request.getShippingWard());
        order.setShippingProvince(request.getShippingProvince());

        for (CreateOrderFromCheckoutRequest.CheckoutItemDto itemDto : request.getItems()) {
            if (itemDto.getQuantity() == null || itemDto.getQuantity() <= 0) {
                throw new BadRequestException("Item quantity must be greater than 0");
            }
            BigDecimal unitPrice = normalizeMoney(itemDto.getSnapshot().getPriceAtCheckout());
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(itemDto.getQuantity())).setScale(2,
                    RoundingMode.HALF_UP);

            OrderItem item = new OrderItem();
            item.setProductName(itemDto.getProductName());
            item.setProductId(itemDto.getProductId());
            item.setColor(itemDto.getColor());
            item.setSize(itemDto.getSize());
            item.setQuantity(itemDto.getQuantity());
            item.setUnitPrice(unitPrice);
            item.setLineTotal(lineTotal);
            item.setSnapshotProductName(itemDto.getSnapshot().getProductName());
            item.setSnapshotVariantSku(itemDto.getSnapshot().getVariantSku());
            item.setSnapshotPriceAtCheckout(unitPrice);
            item.setVariantId(itemDto.getVariantId());
            order.addItem(item);
        }

        try {
            Order saved = orderRepository.save(order);
            publishOrderCreatedEvent(saved);
            return toResponse(saved);
        } catch (DataIntegrityViolationException ex) {
            Order duplicated = orderRepository
                    .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                    .orElseThrow(() -> ex);
            return toResponse(duplicated);
        } catch (Exception ex) {
            log.error("Order creation failed, compensating stock: {}", ex.getMessage());
            try {
                restoreStockForOrder(request.getItems());
            } catch (Exception restoreEx) {
                log.error("Stock compensation ALSO failed — saving to outbox for retry");
                orderEventPublisher.publishStockRestoreFailed(
                        request.getItems().stream()
                                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                                .map(itemDto -> new com.iuh.fit.client.dto.BatchStockRequest(
                                        itemDto.getVariantId(), itemDto.getQuantity()))
                                .collect(Collectors.toList()),
                        ex.getMessage() + " | " + restoreEx.getMessage());
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getMyOrders(Long userId, int page, int size) {
        if (page < 1) {
            throw new BadRequestException("Page must be >= 1");
        }
        if (size <= 0 || size > 100) {
            throw new BadRequestException("Size must be between 1 and 100");
        }

        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orderPage = orderRepository.findAllByUserId(userId, pageable);

        PagedResponse<OrderResponse> response = new PagedResponse<>();
        response.setContent(orderPage.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList()));
        response.setPage(orderPage.getNumber() + 1);
        response.setSize(orderPage.getSize());
        response.setTotalElements(orderPage.getTotalElements());
        response.setTotalPages(orderPage.getTotalPages());
        response.setFirst(orderPage.isFirst());
        response.setLast(orderPage.isLast());
        return response;
    }

    @Transactional(readOnly = true)
    public OrderResponse getMyOrderById(Long userId, Long id) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public Long getOrderUserId(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return order.getUserId();
    }

    @Transactional
    public OrderResponse updateOrderStatus(Long userId, Long id, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        OrderStatus requestedStatus = com.iuh.fit.domain.enums.OrderStatus
                .valueOf(request.getStatus());
        validateStatusTransition(order.getStatus(), requestedStatus);
        String prev = order.getStatus() != null ? order.getStatus().name() : null;
        order.setStatus(requestedStatus);
        Order saved = orderRepository.save(order);
        // record audit for user's own change with actor = userId
        auditService.record(id, userId, prev, requestedStatus.name(), request.getNote());

        if (OrderStatus.valueOf(request.getStatus()) == OrderStatus.CANCELLED && prev != null) {
            restoreStockForOrder(saved);
        }

        return toResponse(saved);
    }

    @Transactional
    public void updateOrderStatusByPaymentService(Long orderId, OrderStatus status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        validateStatusTransition(order.getStatus(), status);
        String prev = order.getStatus() != null ? order.getStatus().name() : null;
        order.setStatus(status);
        orderRepository.save(order);

        if (status == OrderStatus.CANCELLED && prev != null) {
            restoreStockForOrder(order);
        }
    }

    private void restoreStockForOrder(Order order) {
        List<BatchStockRequest> items = order.getItems().stream()
                .filter(item -> item.getVariantId() != null && !item.getVariantId().isBlank())
                .map(item -> new BatchStockRequest(item.getVariantId(), item.getQuantity()))
                .collect(Collectors.toList());

        if (items.isEmpty()) {
            return;
        }

        batchRestoreStock(items);
    }

    private void restoreStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
        List<BatchStockRequest> batchItems = items.stream()
                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity()))
                .collect(Collectors.toList());

        if (batchItems.isEmpty()) {
            return;
        }

        batchRestoreStock(batchItems);
    }

    private void deductStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
        List<BatchStockRequest> batchItems = items.stream()
                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity()))
                .collect(Collectors.toList());

        if (batchItems.isEmpty()) {
            return;
        }

        batchDeductStock(batchItems);
    }

    @CircuitBreaker(name = "productService", fallbackMethod = "deductStockFallback")
    @Retry(name = "productService")
    @Bulkhead(name = "productService")
    public void batchDeductStock(List<BatchStockRequest> items) {
        BatchStockResponse response = productClient.batchDeductStock(items);
        if (!response.success() && response.failedItems() != null && !response.failedItems().isEmpty()) {
            String failedDetails = response.failedItems().stream()
                    .map(f -> f.variantId() + ": " + f.reason())
                    .collect(Collectors.joining(", "));
            throw new BadRequestException("Không thể xử lý đặt hàng: " + failedDetails);
        }
    }

    public void deductStockFallback(List<BatchStockRequest> items, Throwable t) {
        log.error("Stock deduction failed: {}", t.getMessage());
        throw new BadRequestException("Không thể xử lý đặt hàng, vui lòng thử lại");
    }

    @CircuitBreaker(name = "productService", fallbackMethod = "restoreStockFallback")
    @Retry(name = "productService")
    @Bulkhead(name = "productService")
    public void batchRestoreStock(List<BatchStockRequest> items) {
        try {
            BatchStockResponse response = productClient.batchRestoreStock(items);
            if (!response.success() && response.failedItems() != null && !response.failedItems().isEmpty()) {
                String failedDetails = response.failedItems().stream()
                        .map(f -> f.variantId() + ": " + f.reason())
                        .collect(Collectors.joining(", "));
                log.error("Stock restoration partially failed: {}", failedDetails);
            }
        } catch (Exception e) {
            log.error("Stock restoration failed: {}", e.getMessage());
            throw e;
        }
    }

    public void restoreStockFallback(List<BatchStockRequest> items, Throwable t) {
        log.error("Stock restoration failed after retries: {}", t.getMessage());
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getOrdersForAdmin(com.iuh.fit.domain.enums.OrderStatus status,
            java.time.Instant from,
            java.time.Instant to,
            int page,
            int size) {
        if (page < 1)
            throw new BadRequestException("Page must be >= 1");
        if (size <= 0 || size > 200)
            throw new BadRequestException("Size must be between 1 and 200");

        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orderPage;
        if (status != null && from != null && to != null) {
            orderPage = orderRepository.findAllByStatusAndCreatedAtBetween(status, from, to, pageable);
        } else if (status != null) {
            orderPage = orderRepository.findAllByStatus(status, pageable);
        } else if (from != null && to != null) {
            orderPage = orderRepository.findAllByCreatedAtBetween(from, to, pageable);
        } else {
            orderPage = orderRepository.findAll(pageable);
        }

        PagedResponse<OrderResponse> response = new PagedResponse<>();
        response.setContent(orderPage.getContent().stream().map(this::toResponse).collect(Collectors.toList()));
        response.setPage(orderPage.getNumber() + 1);
        response.setSize(orderPage.getSize());
        response.setTotalElements(orderPage.getTotalElements());
        response.setTotalPages(orderPage.getTotalPages());
        response.setFirst(orderPage.isFirst());
        response.setLast(orderPage.isLast());
        return response;
    }

    @Transactional
    public OrderResponse updateOrderStatusAsAdmin(Long adminUserId, Long orderId, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        com.iuh.fit.domain.enums.OrderStatus requestedStatus = com.iuh.fit.domain.enums.OrderStatus
                .valueOf(request.getStatus());
        validateStatusTransition(order.getStatus(), requestedStatus);
        String prev = order.getStatus() != null ? order.getStatus().name() : null;
        order.setStatus(requestedStatus);
        Order saved = orderRepository.save(order);
        auditService.record(orderId, adminUserId, prev, requestedStatus.name(), request.getNote());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderByIdForAdmin(Long id) {
        Order order = orderRepository.findOneById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return toResponse(order);
    }

    private void validateStatusTransition(com.iuh.fit.domain.enums.OrderStatus current,
            com.iuh.fit.domain.enums.OrderStatus requested) {
        if (current == requested)
            return;
        if (current == null)
            return; // no prior state

        switch (current) {
            case PENDING_PAYMENT -> {
                if (requested != com.iuh.fit.domain.enums.OrderStatus.PAID
                        && requested != com.iuh.fit.domain.enums.OrderStatus.CANCELLED) {
                    throw new BadRequestException("Invalid status transition from PENDING_PAYMENT to " + requested);
                }
            }
            case PAID -> {
                if (requested != com.iuh.fit.domain.enums.OrderStatus.CANCELLED) {
                    throw new BadRequestException("Invalid status transition from PAID to " + requested);
                }
            }
            case CANCELLED -> throw new BadRequestException("Cannot change status of a CANCELLED order");
            default -> throw new BadRequestException("Unsupported current order status: " + current);
        }
    }

    @Transactional
    public void deleteMyOrder(Long userId, Long id) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        orderRepository.delete(order);
    }

    private void publishOrderCreatedEvent(Order saved) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    String userEmail = saved.getEmail();
                    if (userEmail != null && !userEmail.isBlank()) {
                        orderEventPublisher.publishOrderCreated(saved.getId(), saved.getUserId(), userEmail);
                    } else {
                        log.warn("Order {} has no email, skipping order created event", saved.getId());
                    }
                } catch (Exception e) {
                    log.error("Failed to publish order created event for orderId {}: {}", saved.getId(), e.getMessage(), e);
                }
            }
        });
    }

    private BigDecimal calculateTotal(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
        return items.stream()
                .map(i -> normalizeMoney(i.getSnapshot().getPriceAtCheckout())
                        .multiply(BigDecimal.valueOf(i.getQuantity()))
                        .setScale(2, RoundingMode.HALF_UP))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        if (value == null) {
            throw new BadRequestException("Amount cannot be null");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private OrderResponse toResponse(Order order) {
        OrderResponse response = new OrderResponse();
        response.setId(order.getId());
        response.setCheckoutOrderId(order.getCheckoutOrderId());
        response.setUserId(order.getUserId());
        response.setStatus(order.getStatus());
        response.setTotalAmount(order.getTotalAmount());
        response.setPaymentMethod(order.getPaymentMethod());
        response.setEmail(order.getEmail());
        response.setShippingStreet(order.getShippingStreet());
        response.setShippingWard(order.getShippingWard());
        response.setShippingProvince(order.getShippingProvince());
        response.setCreatedAt(order.getCreatedAt());
        response.setUpdatedAt(order.getUpdatedAt());

        List<OrderResponse.OrderItemResponse> itemResponses = order.getItems().stream()
                .map(item -> {
                    OrderResponse.OrderItemResponse r = new OrderResponse.OrderItemResponse();
                    r.setId(item.getId());
                    r.setProductId(item.getProductId());
                    r.setProductName(item.getProductName());
                    r.setColor(item.getColor());
                    r.setSize(item.getSize());
                    r.setQuantity(item.getQuantity());
                    r.setUnitPrice(item.getUnitPrice());
                    r.setLineTotal(item.getLineTotal());
                    r.setSnapshotProductName(item.getSnapshotProductName());
                    r.setSnapshotVariantSku(item.getSnapshotVariantSku());
                    r.setSnapshotPriceAtCheckout(item.getSnapshotPriceAtCheckout());
                    return r;
                })
                .collect(Collectors.toList());
        response.setItems(itemResponses);
        return response;
    }
}
