package com.iuh.fit.service;

import com.iuh.fit.config.RabbitMQConfig;
import com.iuh.fit.domain.dto.OrderStatusEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
        publish(event, RabbitMQConfig.ORDER_CREATED_ROUTING_KEY);
    }

    public void publishOrderPaid(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_PAID", orderId, userId, email);
        publish(event, RabbitMQConfig.ORDER_PAID_ROUTING_KEY);
    }

    public void publishOrderCancelled(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CANCELLED", orderId, userId, email);
        publish(event, RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY);
    }

    private void publish(OrderStatusEvent event, String routingKey) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EMAIL_EXCHANGE, routingKey, event);
            log.info("Published order event: type={}, orderId={}, routingKey={}", event.getType(), event.getOrderId(), routingKey);
        } catch (Exception e) {
            log.error("Failed to publish order event: type={}, orderId={}: {}", event.getType(), event.getOrderId(), e.getMessage());
        }
    }
}
