package iuh.fit.notificationservice.Service.Consumer;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Config.RabbitMQConfig;
import iuh.fit.notificationservice.Domain.DTO.OrderStatusEvent;
import iuh.fit.notificationservice.Service.NotificationService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class OrderEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventConsumer.class);

    private final NotificationService notificationService;

    public OrderEventConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitMQConfig.EMAIL_ORDER_QUEUE)
    public void handleOrderEvent(
            OrderStatusEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        if (event == null) {
            log.error("Received null order event, nacking message");
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception e) {
                log.error("Failed to nack null message: {}", e.getMessage());
            }
            return;
        }
        String eventType = event.getType() != null ? event.getType() : "UNKNOWN";
        try {
            log.info("Received order {} event for order {}", eventType.toLowerCase(), event.getOrderId());

            if ("ORDER_CREATED".equals(event.getType())) {
                notificationService.sendOrderCreatedEmail(event);
            } else if ("ORDER_PAID".equals(event.getType())) {
                notificationService.sendOrderPaidEmail(event);
            } else if ("ORDER_CANCELLED".equals(event.getType())) {
                notificationService.sendOrderCancelledEmail(event);
            } else {
                log.warn("Unknown order event type: {} for order {}", event.getType(), event.getOrderId());
                channel.basicNack(deliveryTag, false, false);
                return;
            }

            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed order {} event for order {}", eventType.toLowerCase(), event.getOrderId());
        } catch (Exception e) {
            log.error("Failed to process order {} event for order {}", eventType.toLowerCase(), event.getOrderId(), e);
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for order {}: {}", event.getOrderId(), nackException.getMessage());
            }
        }
    }
}
