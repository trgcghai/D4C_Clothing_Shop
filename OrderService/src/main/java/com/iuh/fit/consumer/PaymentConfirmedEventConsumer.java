package com.iuh.fit.consumer;

import com.iuh.fit.domain.dto.OrderPaidEvent;
import com.iuh.fit.domain.dto.PaymentConfirmedEvent;
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

@Component
public class PaymentConfirmedEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentConfirmedEventConsumer.class);

    private final OrderRepository orderRepository;
    private final OrderEventPublisher orderEventPublisher;

    public PaymentConfirmedEventConsumer(OrderRepository orderRepository, OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.orderEventPublisher = orderEventPublisher;
    }

    @RabbitListener(queues = "payment.confirmed.queue")
    @Transactional
    public void handlePaymentConfirmed(PaymentConfirmedEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.error("Received null or invalid PaymentConfirmedEvent");
            return;
        }

        log.info("Received PaymentConfirmedEvent for orderId: {}", event.getOrderId());

        Order order = orderRepository.findById(event.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found for PaymentConfirmedEvent: orderId=" + event.getOrderId()));

        if (order.getStatus() == OrderStatus.PAID) {
            log.info("Order {} already PAID, skipping", event.getOrderId());
            return;
        }

        order.setStatus(OrderStatus.PAID);
        orderRepository.save(order);
        log.info("Order {} updated to PAID", event.getOrderId());

        OrderPaidEvent orderPaidEvent = new OrderPaidEvent(
                order.getId(), order.getUserId(), order.getCheckoutOrderId()
        );
        orderEventPublisher.publishOrderPaidEvent(orderPaidEvent);

        if (order.getEmail() != null && !order.getEmail().isBlank()) {
            orderEventPublisher.publishOrderPaidEmail(order.getId(), order.getUserId(), order.getEmail());
        }
    }
}
