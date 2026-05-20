package iuh.fit.PaymentService.service;

import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.domain.event.PaymentExpiredEvent;
import iuh.fit.PaymentService.repository.PaymentRepository;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
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
    private final RabbitTemplate rabbitTemplate;

    public PaymentExpiryJob(PaymentRepository paymentRepository, RabbitTemplate rabbitTemplate) {
        this.paymentRepository = paymentRepository;
        this.rabbitTemplate = rabbitTemplate;
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

            PaymentExpiredEvent event = new PaymentExpiredEvent(
                    refreshed.getId(),
                    refreshed.getOrderId(),
                    refreshed.getCheckoutOrderId(),
                    refreshed.getPaymentCode(),
                    refreshed.getAmount(),
                    Instant.now()
            );
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.PAYMENT_EXCHANGE,
                    RabbitMQConfig.PAYMENT_EXPIRED_ROUTING_KEY,
                    event
            );
            log.info("Published PaymentExpiredEvent for payment: {}", refreshed.getId());
        }
    }
}
