package com.iuh.fit.consumer;

import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.PaymentExpiredEvent;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.domain.enums.OrderStatus;
import com.iuh.fit.repository.OrderRepository;
import com.iuh.fit.service.OrderEventPublisher;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PaymentExpiredEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentExpiredEventConsumer.class);

    private final OrderRepository orderRepository;
    private final OrderEventPublisher orderEventPublisher;

    public PaymentExpiredEventConsumer(OrderRepository orderRepository, OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.orderEventPublisher = orderEventPublisher;
    }

    @RabbitListener(queues = "payment.expired.queue")
    @Transactional
    public void handlePaymentExpired(PaymentExpiredEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.error("Received null or invalid PaymentExpiredEvent");
            return;
        }

        log.info("Received PaymentExpiredEvent for orderId: {}", event.getOrderId());

        Order order = orderRepository.findById(event.getOrderId()).orElse(null);
        if (order == null) {
            log.error("Order not found for PaymentExpiredEvent: orderId={}. Acking message to prevent requeue.", event.getOrderId());
            return;
        }

        if (order.getStatus() == OrderStatus.CANCELLED) {
            log.info("Order {} already CANCELLED, skipping", event.getOrderId());
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            log.warn("Order {} is in status {}, cannot cancel", event.getOrderId(), order.getStatus());
            return;
        }

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);
        log.info("Order {} updated to CANCELLED due to payment expiry", event.getOrderId());

        List<OrderCancelledEvent.OrderItemSnapshot> itemSnapshots = order.getItems().stream()
                .map(item -> new OrderCancelledEvent.OrderItemSnapshot(
                        item.getVariantId(), item.getQuantity()
                ))
                .collect(Collectors.toList());

        OrderCancelledEvent cancelEvent = new OrderCancelledEvent(
                order.getId(), order.getUserId(), order.getCheckoutOrderId(), itemSnapshots
        );
        orderEventPublisher.publishOrderCancelledEvent(cancelEvent);

        if (order.getEmail() != null && !order.getEmail().isBlank()) {
            orderEventPublisher.publishOrderCancelledEmail(order.getId(), order.getUserId(), order.getEmail());
        }
    }
}
