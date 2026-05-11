package com.iuh.fit.service;

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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional
    public OrderResponse createOrderFromCheckout(Long userId, CreateOrderFromCheckoutRequest request) {
        Order existing = orderRepository
                .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                .orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        BigDecimal calculatedTotal = calculateTotal(request.getItems());
        BigDecimal requestTotal = normalizeMoney(request.getTotalAmount());
        if (calculatedTotal.compareTo(requestTotal) != 0) {
            throw new BadRequestException("Total amount mismatch. expected=" + calculatedTotal + ", actual=" + requestTotal);
        }

        Order order = new Order();
        order.setUserId(userId);
        order.setCheckoutOrderId(request.getOrderId());
        order.setStatus(OrderStatus.PAID);
        order.setTotalAmount(calculatedTotal);

        for (CreateOrderFromCheckoutRequest.CheckoutItemDto itemDto : request.getItems()) {
            if (itemDto.getQuantity() == null || itemDto.getQuantity() <= 0) {
                throw new BadRequestException("Item quantity must be greater than 0");
            }
            BigDecimal unitPrice = normalizeMoney(itemDto.getSnapshot().getPriceAtCheckout());
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(itemDto.getQuantity())).setScale(2, RoundingMode.HALF_UP);

            OrderItem item = new OrderItem();
            item.setProductName(itemDto.getProductName());
            item.setColor(itemDto.getColor());
            item.setSize(itemDto.getSize());
            item.setQuantity(itemDto.getQuantity());
            item.setUnitPrice(unitPrice);
            item.setLineTotal(lineTotal);
            item.setSnapshotProductName(itemDto.getSnapshot().getProductName());
            item.setSnapshotVariantSku(itemDto.getSnapshot().getVariantSku());
            item.setSnapshotPriceAtCheckout(unitPrice);
            order.addItem(item);
        }

        try {
            Order saved = orderRepository.save(order);
            return toResponse(saved);
        } catch (DataIntegrityViolationException ex) {
            Order duplicated = orderRepository
                    .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                    .orElseThrow(() -> ex);
            return toResponse(duplicated);
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getMyOrders(Long userId, int page, int size) {
        if (page < 0) {
            throw new BadRequestException("Page must be >= 0");
        }
        if (size <= 0 || size > 100) {
            throw new BadRequestException("Size must be between 1 and 100");
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orderPage = orderRepository.findAllByUserId(userId, pageable);

        PagedResponse<OrderResponse> response = new PagedResponse<>();
        response.setContent(orderPage.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList()));
        response.setPage(orderPage.getNumber());
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

    @Transactional
    public OrderResponse updateOrderStatus(Long userId, Long id, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        order.setStatus(request.getStatus());
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public void deleteMyOrder(Long userId, Long id) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        orderRepository.delete(order);
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
        response.setCreatedAt(order.getCreatedAt());
        response.setUpdatedAt(order.getUpdatedAt());

        List<OrderResponse.OrderItemResponse> itemResponses = order.getItems().stream()
                .map(item -> {
                    OrderResponse.OrderItemResponse r = new OrderResponse.OrderItemResponse();
                    r.setId(item.getId());
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
