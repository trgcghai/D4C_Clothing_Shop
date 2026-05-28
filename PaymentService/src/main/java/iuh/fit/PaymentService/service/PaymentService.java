package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.client.OrderClient;
import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.config.SePayConfig;
import iuh.fit.PaymentService.domain.dto.CreatePaymentRequest;
import iuh.fit.PaymentService.domain.dto.PaymentResponse;
import iuh.fit.PaymentService.domain.dto.PaymentStatusResponse;
import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentMethod;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.domain.event.PaymentCancelledEvent;
import iuh.fit.PaymentService.domain.event.PaymentConfirmedEvent;
import iuh.fit.PaymentService.exception.PaymentException;
import iuh.fit.PaymentService.exception.ServiceUnavailableException;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
import iuh.fit.PaymentService.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.UUID;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    @Lazy
    @Autowired
    private PaymentService self;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private SePayConfig sePayConfig;

    @Autowired
    private OrderClient orderClient;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private OutboxEventRepository outboxRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${feature.outbox.enabled:false}")
    private boolean outboxEnabled;

    @Transactional
    public PaymentResponse createPayment(CreatePaymentRequest request, Long requestingUserId) {
        Long orderUserId = self.getOrderUserIdWithCB(request.getOrderId());
        if (!orderUserId.equals(requestingUserId)) {
            throw new PaymentException("Access denied: you do not own this order");
        }

        Payment existing = paymentRepository.findByCheckoutOrderId(request.getCheckoutOrderId())
                .orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        Payment payment = new Payment();
        payment.setOrderId(request.getOrderId());
        payment.setCheckoutOrderId(request.getCheckoutOrderId());
        payment.setAmount(request.getAmount());
        payment.setMethod(request.getMethod());
        payment.setStatus(PaymentStatus.PENDING);
        payment.setPaymentCode(sePayConfig.generatePaymentCode());
        payment.setExpiresAt(Instant.now().plusSeconds(5 * 60));

        payment = paymentRepository.save(payment);
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentById(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentException("Payment not found with id: " + paymentId));
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentStatusResponse getPaymentStatus(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentException("Payment not found with id: " + paymentId));
        return new PaymentStatusResponse(payment.getId(), payment.getStatus(), payment.getPaidAt());
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByCheckoutOrderId(String checkoutOrderId) {
        Payment payment = paymentRepository.findByCheckoutOrderId(checkoutOrderId)
                .orElseThrow(() -> new PaymentException("Payment not found for order: " + checkoutOrderId));
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByPaymentCode(String paymentCode) {
        Payment payment = paymentRepository.findByPaymentCode(paymentCode)
                .orElseThrow(() -> new PaymentException("Payment not found for code: " + paymentCode));
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByOrderId(Long orderId, Long requestingUserId) {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new PaymentException("Payment not found for orderId: " + orderId));

        Long orderUserId = self.getOrderUserIdWithCB(orderId);
        if (!orderUserId.equals(requestingUserId)) {
            throw new PaymentException("Access denied: you do not own this order");
        }

        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public Payment findPaymentByPaymentCodeOrNull(String paymentCode) {
        return paymentRepository.findByPaymentCode(paymentCode).orElse(null);
    }

    @Transactional
    public PaymentStatusResponse cancelPayment(Long paymentId) {
        int updated = paymentRepository.cancelPayment(paymentId);
        if (updated == 0) {
            Payment payment = paymentRepository.findById(paymentId)
                    .orElseThrow(() -> new PaymentException("Payment not found"));
            throw new PaymentException("Cannot cancel payment with status: " + payment.getStatus());
        }

        Payment payment = paymentRepository.findById(paymentId).orElse(null);
        if (payment != null) {
            PaymentCancelledEvent event = new PaymentCancelledEvent(
                    payment.getId(),
                    payment.getOrderId(),
                    payment.getCheckoutOrderId(),
                    payment.getPaymentCode(),
                    payment.getAmount(),
                    Instant.now()
            );
            publishEvent(event, "PAYMENT_CANCELLED", payment.getId(),
                    RabbitMQConfig.PAYMENT_EXCHANGE, RabbitMQConfig.PAYMENT_CANCELLED_ROUTING_KEY);
        }

        return new PaymentStatusResponse(paymentId, PaymentStatus.CANCELLED, null);
    }

    private PaymentResponse getOrderUserIdFallback(CreatePaymentRequest request, Long requestingUserId, Throwable t) {
        log.error("[CircuitBreaker] PaymentService: OrderService unavailable calling getOrderUserId({}): {}", request.getOrderId(), t.getMessage());
        throw new ServiceUnavailableException("Không thể xác thực đơn hàng, vui lòng thử lại sau");
    }

    private PaymentResponse getOrderUserIdFallbackForPayment(Long orderId, Long requestingUserId, Throwable t) {
        log.error("[CircuitBreaker] PaymentService: OrderService unavailable calling getOrderUserId({}): {}", orderId, t.getMessage());
        throw new ServiceUnavailableException("Không thể xác thực đơn hàng, vui lòng thử lại sau");
    }

    @CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallbackForPaymentCB")
    @Retry(name = "orderService")
    @Bulkhead(name = "orderService")
    Long getOrderUserIdWithCB(Long orderId) {
        return orderClient.getOrderUserId(orderId);
    }

    private Long getOrderUserIdFallbackForPaymentCB(Long orderId, Throwable t) {
        log.error("[CircuitBreaker] PaymentService: OrderService unavailable calling getOrderUserId({}): {}", orderId, t.getMessage());
        throw new ServiceUnavailableException("Không thể xác thực đơn hàng, vui lòng thử lại sau");
    }

    private void publishEvent(Object event, String eventType, Long aggregateId, String exchange, String routingKey) {
        if (outboxEnabled) {
            try {
                String payload = objectMapper.writeValueAsString(event);
                OutboxEvent outboxEvent = OutboxEvent.builder()
                        .eventType(eventType)
                        .eventId(UUID.randomUUID().toString())
                        .aggregateId(aggregateId)
                        .payload(payload)
                        .exchange(exchange)
                        .routingKey(routingKey)
                        .build();
                outboxRepository.save(outboxEvent);
                log.debug("Saved {} event to outbox for aggregateId={}", eventType, aggregateId);
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize {} event for aggregateId={}: {}", eventType, aggregateId, e.getMessage());
            }
        } else {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
            log.info("Published event to exchange={}, routingKey={}", exchange, routingKey);
        }
    }

    @Value("${payment.webhook.grace-period-seconds:3600}")
    private long gracePeriodSeconds;

    @Transactional
    public PaymentStatusResponse markAsPaid(String paymentCode, Long sepayTxId, String gateway) {
        Instant now = Instant.now();
        int updated = paymentRepository.markAsPaid(paymentCode, sepayTxId, gateway, now);
        if (updated == 0) {
            Payment payment = paymentRepository.findByPaymentCode(paymentCode)
                    .orElseThrow(() -> new PaymentException("Payment not found: " + paymentCode));
            if (payment.getStatus() == PaymentStatus.PAID) {
                return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, payment.getPaidAt());
            }

            if (payment.getStatus() == PaymentStatus.EXPIRED) {
                Instant gracePeriodEnd = payment.getExpiresAt().plusSeconds(gracePeriodSeconds);
                if (now.isBefore(gracePeriodEnd)) {
                    payment.setStatus(PaymentStatus.PAID);
                    payment.setSepayTransactionId(sepayTxId);
                    payment.setSepayGateway(gateway);
                    payment.setPaidAt(now);
                    paymentRepository.save(payment);
                    log.info("Late webhook accepted for payment {} within grace period", paymentCode);

                    payment.setReconciliationStatus("PAID_NEEDS_RECONCILE");
                    paymentRepository.save(payment);
                    log.error("Payment {} PAID but was EXPIRED — requires reconciliation", paymentCode);

                    PaymentConfirmedEvent event = new PaymentConfirmedEvent(
                            payment.getId(),
                            payment.getOrderId(),
                            payment.getCheckoutOrderId(),
                            payment.getPaymentCode(),
                            payment.getAmount(),
                            sepayTxId,
                            gateway,
                            now
                    );
                    publishEvent(event, "PAYMENT_CONFIRMED", payment.getId(),
                            RabbitMQConfig.PAYMENT_EXCHANGE, RabbitMQConfig.PAYMENT_CONFIRMED_ROUTING_KEY);

                    return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, now);
                }
            }

            throw new PaymentException("Payment already " + payment.getStatus());
        }
        Payment payment = paymentRepository.findByPaymentCode(paymentCode).orElseThrow();
        PaymentConfirmedEvent event = new PaymentConfirmedEvent(
                payment.getId(),
                payment.getOrderId(),
                payment.getCheckoutOrderId(),
                payment.getPaymentCode(),
                payment.getAmount(),
                sepayTxId,
                gateway,
                now
        );
        publishEvent(event, "PAYMENT_CONFIRMED", payment.getId(),
                RabbitMQConfig.PAYMENT_EXCHANGE, RabbitMQConfig.PAYMENT_CONFIRMED_ROUTING_KEY);
        return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, now);
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> getAllPayments(Pageable pageable) {
        return paymentRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> getPaymentsByStatus(PaymentStatus status, Pageable pageable) {
        return paymentRepository.findByStatus(status, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public java.util.List<PaymentResponse> getPendingPaymentsByAmount(Long amount) {
        return paymentRepository.findPendingByAmount(amount).stream()
                .map(this::toResponse)
                .collect(java.util.stream.Collectors.toList());
    }

    private PaymentResponse toResponse(Payment payment) {
        PaymentResponse response = new PaymentResponse();
        response.setPaymentId(payment.getId());
        response.setOrderId(payment.getOrderId());
        response.setCheckoutOrderId(payment.getCheckoutOrderId());
        response.setPaymentCode(payment.getPaymentCode());
        response.setAmount(payment.getAmount());
        response.setMethod(payment.getMethod());
        response.setStatus(payment.getStatus());
        response.setExpiresAt(payment.getExpiresAt());
        response.setCreatedAt(payment.getCreatedAt());
        response.setSepayTransactionId(payment.getSepayTransactionId());
        response.setSepayGateway(payment.getSepayGateway());
        response.setPaidAt(payment.getPaidAt());

        if (payment.getMethod() == PaymentMethod.QR && payment.getStatus() == PaymentStatus.PENDING) {
            response.setQrUrl(sePayConfig.generateQrUrl(payment.getAmount(), payment.getPaymentCode()));
        }

        return response;
    }
}
