package com.iuh.fit.service;

import com.iuh.fit.domain.entity.OutboxEvent;
import com.iuh.fit.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of());

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).findRetryableEvents(PageRequest.of(0, 100));
        verifyNoMoreInteractions(outboxRepository);
        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void shouldPublishPendingEventsAndMarkAsPublished() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(1L)
                .eventType("ORDER_CREATED")
                .eventId("event-1")
                .aggregateId(1L)
                .payload("{\"orderId\": 1}")
                .exchange("order-exchange")
                .routingKey("order.created")
                .build();

        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));

        outboxPublisherJob.publishPendingEvents();

        verify(rabbitTemplate).convertAndSend("order-exchange", "order.created", "{\"orderId\": 1}");
        verify(outboxRepository).save(argThat(saved ->
                "PUBLISHED".equals(saved.getStatus()) && saved.getPublishedAt() != null));
    }

    @Test
    void shouldIncrementRetryCountOnPublishFailure() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(2L)
                .eventType("ORDER_CREATED")
                .eventId("event-2")
                .aggregateId(2L)
                .payload("{\"orderId\": 2}")
                .exchange("order-exchange")
                .routingKey("order.created")
                .retryCount(0)
                .maxRetries(5)
                .build();

        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
        doThrow(new RuntimeException("Connection refused")).when(rabbitTemplate)
                .convertAndSend("order-exchange", "order.created", "{\"orderId\": 2}");

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).save(argThat(saved ->
                saved.getRetryCount() == 1 &&
                !"FAILED".equals(saved.getStatus()) &&
                saved.getErrorMessage() != null &&
                saved.getErrorMessage().contains("Connection refused")));
    }

    @Test
    void shouldMarkAsFailedAfterMaxRetriesExceeded() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(3L)
                .eventType("ORDER_CREATED")
                .eventId("event-3")
                .aggregateId(3L)
                .payload("{\"orderId\": 3}")
                .exchange("order-exchange")
                .routingKey("order.created")
                .retryCount(4)
                .maxRetries(5)
                .build();

        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
        doThrow(new RuntimeException("Timeout")).when(rabbitTemplate)
                .convertAndSend("order-exchange", "order.created", "{\"orderId\": 3}");

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).save(argThat(saved ->
                saved.getRetryCount() == 5 &&
                "FAILED".equals(saved.getStatus()) &&
                saved.getErrorMessage() != null &&
                saved.getErrorMessage().contains("Timeout")));
    }

    @Test
    void shouldProcessMultipleEventsInBatch() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event1 = OutboxEvent.builder()
                .id(10L)
                .eventType("ORDER_CREATED")
                .eventId("event-10")
                .aggregateId(10L)
                .payload("{\"orderId\": 10}")
                .exchange("order-exchange")
                .routingKey("order.created")
                .build();

        OutboxEvent event2 = OutboxEvent.builder()
                .id(11L)
                .eventType("ORDER_CANCELLED")
                .eventId("event-11")
                .aggregateId(11L)
                .payload("{\"orderId\": 11}")
                .exchange("order-exchange")
                .routingKey("order.cancelled")
                .build();

        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event1, event2));

        outboxPublisherJob.publishPendingEvents();

        verify(rabbitTemplate).convertAndSend("order-exchange", "order.created", "{\"orderId\": 10}");
        verify(rabbitTemplate).convertAndSend("order-exchange", "order.cancelled", "{\"orderId\": 11}");
        verify(outboxRepository, times(2)).save(argThat(saved ->
                "PUBLISHED".equals(saved.getStatus()) && saved.getPublishedAt() != null));
    }

    @Test
    void shouldSetRetryAfterWithExponentialDelay() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(5L)
                .eventType("ORDER_CREATED")
                .eventId("event-5")
                .aggregateId(5L)
                .payload("{\"orderId\": 5}")
                .exchange("order-exchange")
                .routingKey("order.created")
                .retryCount(0)
                .maxRetries(5)
                .build();

        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
        doThrow(new RuntimeException("Connection refused")).when(rabbitTemplate)
                .convertAndSend("order-exchange", "order.created", "{\"orderId\": 5}");

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).save(argThat(saved ->
                saved.getRetryCount() == 1 &&
                saved.getRetryAfter() != null &&
                saved.getRetryAfter().isAfter(Instant.now().plusSeconds(3)) &&
                saved.getRetryAfter().isBefore(Instant.now().plusSeconds(10))));
    }

    @Test
    void shouldSkipEventsWithFutureRetryAfter() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of());

        outboxPublisherJob.publishPendingEvents();

        verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), anyString());
    }

    @Test
    void shouldIncludeExceptionClassInErrorMessage() {
        outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

        OutboxEvent event = OutboxEvent.builder()
                .id(7L)
                .eventType("ORDER_CREATED")
                .eventId("event-7")
                .aggregateId(7L)
                .payload("{\"orderId\": 7}")
                .exchange("order-exchange")
                .routingKey("order.created")
                .retryCount(0)
                .maxRetries(5)
                .build();

        when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
        doThrow(new RuntimeException("Connection refused")).when(rabbitTemplate)
                .convertAndSend("order-exchange", "order.created", "{\"orderId\": 7}");

        outboxPublisherJob.publishPendingEvents();

        verify(outboxRepository).save(argThat(saved ->
                saved.getErrorMessage() != null &&
                saved.getErrorMessage().startsWith("RuntimeException: ")));
    }
}
