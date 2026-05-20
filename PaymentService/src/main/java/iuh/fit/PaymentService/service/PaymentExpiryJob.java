package iuh.fit.PaymentService.service;

import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.domain.event.PaymentExpiredEvent;
import iuh.fit.PaymentService.repository.PaymentRepository;

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
    @Transactional
    public void expirePendingPayments() {
        // Query PENDING payments that are about to expire BEFORE updating
        // This avoids the race condition of fetching by EXPIRED status (which could include previous runs)
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

        // Publish events for the payments we identified
        for (Payment payment : expiringPayments) {
            PaymentExpiredEvent event = new PaymentExpiredEvent(
                    payment.getId(),
                    payment.getOrderId(),
                    payment.getCheckoutOrderId(),
                    payment.getPaymentCode(),
                    payment.getAmount(),
                    Instant.now()
            );
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.PAYMENT_EXCHANGE,
                    RabbitMQConfig.PAYMENT_EXPIRED_ROUTING_KEY,
                    event
            );
            log.info("Published PaymentExpiredEvent for payment: {}", payment.getId());
        }
    }
}
