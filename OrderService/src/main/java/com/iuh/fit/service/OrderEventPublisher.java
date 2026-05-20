package com.iuh.fit.service;

import com.iuh.fit.config.RabbitMQConfig;
import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.OrderPaidEvent;
import com.iuh.fit.domain.dto.OrderStatusEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public OrderEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishOrderCreated(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CREATED", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CREATED_ROUTING_KEY);
    }

    public void publishOrderPaidEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_PAID", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_PAID_ROUTING_KEY);
    }

    public void publishOrderCancelledEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CANCELLED", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY);
    }

    public void publishOrderPaidEvent(OrderPaidEvent event) {
        publish(event, RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_PAID_EVENT_ROUTING_KEY);
    }

    public void publishOrderCancelledEvent(OrderCancelledEvent event) {
        publish(event, RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_EVENT_ROUTING_KEY);
    }

    private void publish(Object event, String exchange, String routingKey) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
            log.info("Published event to exchange={}, routingKey={}", exchange, routingKey);
        } catch (AmqpException e) {
            log.warn("Failed to publish event to exchange={}, routingKey={}: {}", exchange, routingKey, e.getMessage());
        }
    }
}
