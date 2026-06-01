package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
import iuh.fit.PaymentService.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentExpiryJobTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public PaymentExpiryJobTest() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    private Payment createExpiredPayment() {
        Payment p = new Payment();
        p.setId(1L);
        p.setOrderId(100L);
        p.setCheckoutOrderId("checkout-123");
        p.setPaymentCode("PAY-001");
        p.setAmount(50000L);
        p.setStatus(PaymentStatus.EXPIRED);
        p.setExpiresAt(Instant.now().minusSeconds(300));
        return p;
    }

    @Test
    void shouldSaveToOutboxWhenExpiringPayment() {
        Payment payment = createExpiredPayment();
        Page<Payment> page = new PageImpl<>(List.of(payment));
        when(paymentRepository.findByStatus(eq(PaymentStatus.PENDING), any(Pageable.class))).thenReturn(page);
        when(paymentRepository.expirePendingPayments(any(Instant.class))).thenReturn(1);
        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        PaymentExpiryJob job = new PaymentExpiryJob(paymentRepository, outboxRepository, objectMapper);
        job.expirePendingPayments();

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent saved = captor.getValue();
        assertThat(saved.getEventType()).isEqualTo("PAYMENT_EXPIRED");
        assertThat(saved.getExchange()).isEqualTo("payment.exchange");
        assertThat(saved.getRoutingKey()).isEqualTo("payment.expired");
        assertThat(saved.getAggregateId()).isEqualTo(1L);
    }

    @Test
    void shouldSaveToOutboxWithoutRabbitMqDependency() {
        Payment payment = createExpiredPayment();
        Page<Payment> page = new PageImpl<>(List.of(payment));
        when(paymentRepository.findByStatus(eq(PaymentStatus.PENDING), any(Pageable.class))).thenReturn(page);
        when(paymentRepository.expirePendingPayments(any(Instant.class))).thenReturn(1);
        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        PaymentExpiryJob job = new PaymentExpiryJob(paymentRepository, outboxRepository, objectMapper);

        // Should NOT throw — outbox save doesn't depend on RabbitMQ
        job.expirePendingPayments();

        verify(outboxRepository).save(any(OutboxEvent.class));
    }
}
