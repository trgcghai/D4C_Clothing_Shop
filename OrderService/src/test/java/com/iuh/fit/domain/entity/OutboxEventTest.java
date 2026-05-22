package com.iuh.fit.domain.entity;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OutboxEventTest {

    @Test
    void shouldBuildOutboxEventWithDefaults() {
        OutboxEvent event = OutboxEvent.builder()
                .eventType("ORDER_CREATED")
                .eventId("test-event-id-123")
                .aggregateId(1L)
                .payload("{\"orderId\": 1}")
                .exchange("order-exchange")
                .routingKey("order.created")
                .build();

        assertEquals("ORDER_CREATED", event.getEventType());
        assertEquals("test-event-id-123", event.getEventId());
        assertEquals(1L, event.getAggregateId());
        assertEquals("{\"orderId\": 1}", event.getPayload());
        assertEquals("order-exchange", event.getExchange());
        assertEquals("order.created", event.getRoutingKey());
        assertEquals("PENDING", event.getStatus());
        assertEquals(0, event.getRetryCount());
        assertEquals(5, event.getMaxRetries());
        assertNull(event.getPublishedAt());
        assertNull(event.getErrorMessage());
    }

    @Test
    void shouldAllowCustomStatusAndRetryValues() {
        OutboxEvent event = OutboxEvent.builder()
                .eventType("PAYMENT_FAILED")
                .eventId("event-456")
                .aggregateId(2L)
                .payload("{\"error\": \"timeout\"}")
                .exchange("payment-exchange")
                .routingKey("payment.failed")
                .status("FAILED")
                .retryCount(3)
                .maxRetries(10)
                .errorMessage("Connection timeout")
                .build();

        assertEquals("FAILED", event.getStatus());
        assertEquals(3, event.getRetryCount());
        assertEquals(10, event.getMaxRetries());
        assertEquals("Connection timeout", event.getErrorMessage());
    }

    @Test
    void shouldSetIdToNullBeforePersistence() {
        OutboxEvent event = OutboxEvent.builder()
                .eventType("ORDER_SHIPPED")
                .eventId("event-789")
                .aggregateId(3L)
                .payload("{}")
                .exchange("order-exchange")
                .routingKey("order.shipped")
                .build();

        assertNull(event.getId());
    }
}
