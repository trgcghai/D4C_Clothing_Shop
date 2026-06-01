package com.iuh.fit.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuh.fit.config.RabbitMQConfig;
import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.OrderPaidEvent;
import com.iuh.fit.domain.dto.OrderStatusEvent;
import com.iuh.fit.domain.entity.OutboxEvent;
import com.iuh.fit.domain.event.StockRestoreFailedEvent;
import com.iuh.fit.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final boolean outboxEnabled;

    public OrderEventPublisher(RabbitTemplate rabbitTemplate,
                               OutboxEventRepository outboxRepository,
                               ObjectMapper objectMapper,
                               @Value("${feature.outbox.enabled:false}") boolean outboxEnabled) {
        this.rabbitTemplate = rabbitTemplate;
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
        this.outboxEnabled = outboxEnabled;
    }

    public void publishOrderCreated(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CREATED", orderId, userId, email);
        publish(event, "ORDER_CREATED", orderId, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CREATED_ROUTING_KEY);
    }

    public void publishOrderPaidEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_PAID", orderId, userId, email);
        publish(event, "ORDER_PAID", orderId, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_PAID_ROUTING_KEY);
    }

    public void publishOrderCancelledEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CANCELLED", orderId, userId, email);
        publish(event, "ORDER_CANCELLED", orderId, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY);
    }

    public void publishOrderPaidEvent(OrderPaidEvent event) {
        publish(event, "ORDER_PAID", event.getOrderId(), RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_PAID_EVENT_ROUTING_KEY);
    }

    public void publishOrderCancelledEvent(OrderCancelledEvent event) {
        publish(event, "ORDER_CANCELLED", event.getOrderId(), RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_EVENT_ROUTING_KEY);
    }

    public void publishStockRestoreFailed(List<com.iuh.fit.client.dto.BatchStockRequest> items, String reason) {
        StockRestoreFailedEvent event = new StockRestoreFailedEvent(
                items.stream()
                        .map(i -> new StockRestoreFailedEvent.StockItem(i.variantId(), i.quantity()))
                        .collect(java.util.stream.Collectors.toList()),
                reason,
                java.time.Instant.now()
        );
        publish(event, "STOCK_RESTORE_FAILED", null,
                RabbitMQConfig.ORDER_EXCHANGE, "stock.restore.failed");
    }

    private void publish(Object event, String eventType, Long aggregateId, String exchange, String routingKey) {
        if (outboxEnabled) {
            saveToOutbox(event, eventType, aggregateId, exchange, routingKey);
        } else {
            publishDirect(event, exchange, routingKey);
        }
    }

    private void saveToOutbox(Object event, String eventType, Long aggregateId, String exchange, String routingKey) {
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
    }

    private void publishDirect(Object event, String exchange, String routingKey) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
            log.info("Published event to exchange={}, routingKey={}", exchange, routingKey);
        } catch (AmqpException e) {
            log.warn("Failed to publish event to exchange={}, routingKey={}: {}", exchange, routingKey, e.getMessage());
        }
    }
}
