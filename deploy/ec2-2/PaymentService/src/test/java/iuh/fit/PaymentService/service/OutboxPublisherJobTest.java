package iuh.fit.PaymentService.service;

import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxPublisherJobTest {

    @Mock
    private OutboxEventRepository outboxRepository;

    @Mock
    private RabbitTemplate rabbitTemplate;

    private OutboxPublisherJob outboxPublisherJob;

    @Test
    void shouldDoNothingWhenOutboxDisabled() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, false);

        outboxPublisherJob.publishPendingEvents();

        verifyNoInteractions(outboxRepository);
        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void shouldDoNothingWhenNoPendingEvents() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);
        when(outboxRepository.findPendingEvents(PageRequest.of(0, 100))).thenReturn(List.of());

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).findPendingEvents(PageRequest.of(0, 100));
        verifyNoMoreInteractions(outboxRepository);
        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void shouldPublishPendingEventsAndMarkAsPublished() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(1L)
                .eventType("PAYMENT_COMPLETED")
                .eventId("event-1")
                .aggregateId(1L)
                .payload("{\"paymentId\": 1}")
                .exchange("payment-exchange")
                .routingKey("payment.completed")
                .build();

        when(outboxRepository.findPendingEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));

        outboxPublisherJob.publishPendingEvents();

        verify(rabbitTemplate).convertAndSend("payment-exchange", "payment.completed", "{\"paymentId\": 1}");
        verify(outboxRepository).save(argThat(saved ->
                "PUBLISHED".equals(saved.getStatus()) && saved.getPublishedAt() != null));
    }

    @Test
    void shouldIncrementRetryCountOnPublishFailure() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(2L)
                .eventType("PAYMENT_COMPLETED")
                .eventId("event-2")
                .aggregateId(2L)
                .payload("{\"paymentId\": 2}")
                .exchange("payment-exchange")
                .routingKey("payment.completed")
                .retryCount(0)
                .maxRetries(5)
                .build();

        when(outboxRepository.findPendingEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
        doThrow(new RuntimeException("Connection refused")).when(rabbitTemplate)
                .convertAndSend("payment-exchange", "payment.completed", "{\"paymentId\": 2}");

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).save(argThat(saved ->
                saved.getRetryCount() == 1 &&
                !"FAILED".equals(saved.getStatus()) &&
                "Connection refused".equals(saved.getErrorMessage())));
    }

    @Test
    void shouldMarkAsFailedAfterMaxRetriesExceeded() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(3L)
                .eventType("PAYMENT_COMPLETED")
                .eventId("event-3")
                .aggregateId(3L)
                .payload("{\"paymentId\": 3}")
                .exchange("payment-exchange")
                .routingKey("payment.completed")
                .retryCount(4)
                .maxRetries(5)
                .build();

        when(outboxRepository.findPendingEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
        doThrow(new RuntimeException("Timeout")).when(rabbitTemplate)
                .convertAndSend("payment-exchange", "payment.completed", "{\"paymentId\": 3}");

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).save(argThat(saved ->
                saved.getRetryCount() == 5 &&
                "FAILED".equals(saved.getStatus()) &&
                "Timeout".equals(saved.getErrorMessage())));
    }

    @Test
    void shouldProcessMultipleEventsInBatch() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event1 = OutboxEvent.builder()
                .id(10L)
                .eventType("PAYMENT_COMPLETED")
                .eventId("event-10")
                .aggregateId(10L)
                .payload("{\"paymentId\": 10}")
                .exchange("payment-exchange")
                .routingKey("payment.completed")
                .build();

        OutboxEvent event2 = OutboxEvent.builder()
                .id(11L)
                .eventType("PAYMENT_FAILED")
                .eventId("event-11")
                .aggregateId(11L)
                .payload("{\"paymentId\": 11}")
                .exchange("payment-exchange")
                .routingKey("payment.failed")
                .build();

        when(outboxRepository.findPendingEvents(PageRequest.of(0, 100))).thenReturn(List.of(event1, event2));

        outboxPublisherJob.publishPendingEvents();

        verify(rabbitTemplate).convertAndSend("payment-exchange", "payment.completed", "{\"paymentId\": 10}");
        verify(rabbitTemplate).convertAndSend("payment-exchange", "payment.failed", "{\"paymentId\": 11}");
        verify(outboxRepository, times(2)).save(argThat(saved ->
                "PUBLISHED".equals(saved.getStatus()) && saved.getPublishedAt() != null));
    }
}
