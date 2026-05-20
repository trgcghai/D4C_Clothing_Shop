package com.iuh.fit.consumer;

import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.PaymentCancelledEvent;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.domain.enums.OrderStatus;
import com.iuh.fit.exception.ResourceNotFoundException;
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
public class PaymentCancelledEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentCancelledEventConsumer.class);

    private final OrderRepository orderRepository;
    private final OrderEventPublisher orderEventPublisher;

    public PaymentCancelledEventConsumer(OrderRepository orderRepository, OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.orderEventPublisher = orderEventPublisher;
    }

    @RabbitListener(queues = "payment.cancelled.queue")
    @Transactional
    public void handlePaymentCancelled(PaymentCancelledEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.error("Received null or invalid PaymentCancelledEvent");
            return;
        }

        log.info("Received PaymentCancelledEvent for orderId: {}", event.getOrderId());

        Order order = orderRepository.findById(event.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found for PaymentCancelledEvent: orderId=" + event.getOrderId()));

        if (order.getStatus() == OrderStatus.CANCELLED) {
            log.info("Order {} already CANCELLED, skipping", event.getOrderId());
            return;
        }

        if (order.getStatus() == OrderStatus.PAID) {
            log.warn("Order {} is already PAID, cannot cancel. Payment was cancelled after payment completed.", event.getOrderId());
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            log.warn("Order {} is in status {}, cannot cancel", event.getOrderId(), order.getStatus());
            return;
        }

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);
        log.info("Order {} updated to CANCELLED due to payment cancellation", event.getOrderId());

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
