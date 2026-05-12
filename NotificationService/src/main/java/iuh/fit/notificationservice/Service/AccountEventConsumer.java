package iuh.fit.notificationservice.Service;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Config.RabbitMQConfig;
import iuh.fit.notificationservice.Domain.DTO.AccountEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class AccountEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(AccountEventConsumer.class);

    private final NotificationService notificationService;

    public AccountEventConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitMQConfig.EMAIL_ACCOUNT_QUEUE)
    public void handleAccountEvent(
            AccountEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            log.info("Received account {} event for user {}", event.getType().toLowerCase(), event.getUserId());

            if ("LOCKED".equals(event.getType())) {
                notificationService.sendAccountLockedEmail(event);
            } else if ("UNLOCKED".equals(event.getType())) {
                notificationService.sendAccountUnlockedEmail(event);
            } else {
                log.warn("Unknown account event type: {} for user {}", event.getType(), event.getUserId());
                channel.basicNack(deliveryTag, false, false);
                return;
            }

            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed account {} event for user {}", event.getType().toLowerCase(), event.getUserId());
        } catch (Exception e) {
            log.error("Failed to process account {} event for user {}: {}", event.getType(), event.getUserId(), e.getMessage());
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for user {}: {}", event.getUserId(), nackException.getMessage());
            }
        }
    }
}
