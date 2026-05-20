package iuh.fit.CartService.consumer;

import iuh.fit.CartService.service.CartService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class OrderPaidEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderPaidEventConsumer.class);

    private final CartService cartService;

    public OrderPaidEventConsumer(CartService cartService) {
        this.cartService = cartService;
    }

    @RabbitListener(queues = "order.paid.queue")
    public void handleOrderPaid(Map<String, Object> event) {
        if (event == null) {
            log.error("Received null OrderPaidEvent");
            return;
        }

        Long userId = event.get("userId") != null ? Long.valueOf(event.get("userId").toString()) : null;
        if (userId == null) {
            log.error("OrderPaidEvent has no userId");
            return;
        }

        log.info("Received OrderPaidEvent for userId: {}", userId);

        try {
            cartService.clearCart(userId);
            log.info("Cart cleared for userId: {}", userId);
        } catch (Exception e) {
            log.error("Failed to clear cart for userId {}: {}", userId, e.getMessage());
            throw e;
        }
    }
}
