package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
import iuh.fit.PaymentService.repository.PaymentRepository;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class PaymentExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(PaymentExpiryJob.class);

    private final PaymentRepository paymentRepository;
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public PaymentExpiryJob(PaymentRepository paymentRepository,
                            OutboxEventRepository outboxRepository,
                            ObjectMapper objectMapper) {
        this.paymentRepository = paymentRepository;
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedRate = 60000)
    @SchedulerLock(name = "paymentExpiryJob", lockAtMostFor = "55s", lockAtLeastFor = "30s")
    @Transactional
    public void expirePendingPayments() {
        // Query PENDING payments that have expired
        List<Payment> expiringPayments = paymentRepository.findByStatus(PaymentStatus.PENDING,
                PageRequest.of(0, 1000)).getContent().stream()
                .filter(p -> p.getExpiresAt() != null && p.getExpiresAt().isBefore(Instant.now()))
                .toList();

        if (expiringPayments.isEmpty()) {
            return;
        }

        // Mark them as EXPIRED
        int expired = paymentRepository.expirePendingPayments(Instant.now());
        log.info("Expired {} pending payments", expired);

        // Re-fetch each payment to check for race with webhook
        for (Payment payment : expiringPayments) {
            Payment refreshed = paymentRepository.findById(payment.getId()).orElse(null);
            if (refreshed == null) {
                log.warn("Payment {} not found after expiry, skipping event", payment.getId());
                continue;
            }

            if (refreshed.getStatus() == PaymentStatus.PAID) {
                log.warn("Payment {} was PAID after expiry job fetched it (race with webhook). Skipping PaymentExpiredEvent.", payment.getId());
                continue;
            }

            if (refreshed.getStatus() != PaymentStatus.EXPIRED) {
                log.warn("Payment {} is in status {} after expiry, skipping event", payment.getId(), refreshed.getStatus());
                continue;
            }

            try {
                var eventPayload = new java.util.HashMap<String, Object>();
                eventPayload.put("paymentId", refreshed.getId());
                eventPayload.put("orderId", refreshed.getOrderId());
                eventPayload.put("checkoutOrderId", refreshed.getCheckoutOrderId());
                eventPayload.put("paymentCode", refreshed.getPaymentCode());
                eventPayload.put("amount", refreshed.getAmount());
                eventPayload.put("expiredAt", Instant.now());
                String payload = objectMapper.writeValueAsString(eventPayload);
                OutboxEvent outboxEvent = OutboxEvent.builder()
                        .eventType("PAYMENT_EXPIRED")
                        .eventId(UUID.randomUUID().toString())
                        .aggregateId(refreshed.getId())
                        .payload(payload)
                        .exchange(RabbitMQConfig.PAYMENT_EXCHANGE)
                        .routingKey(RabbitMQConfig.PAYMENT_EXPIRED_ROUTING_KEY)
                        .build();
                outboxRepository.save(outboxEvent);
                log.info("Saved PAYMENT_EXPIRED to outbox for payment: {}", refreshed.getId());
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize PAYMENT_EXPIRED event for payment {}: {}", refreshed.getId(), e.getMessage());
            }
        }
    }
}
