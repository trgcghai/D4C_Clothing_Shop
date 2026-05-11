package iuh.fit.notificationservice.Service;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Config.RabbitMQConfig;
import iuh.fit.notificationservice.Domain.DTO.AccountLockedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class AccountLockedConsumer {

    private static final Logger log = LoggerFactory.getLogger(AccountLockedConsumer.class);

    private final NotificationService notificationService;

    public AccountLockedConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitMQConfig.EMAIL_ACCOUNT_QUEUE)
    public void handleAccountLockedEmail(
            AccountLockedEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            log.info("Received account locked email event for user {}", event.getUserId());
            notificationService.sendAccountLockedEmail(event);
            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed account locked email for user {}", event.getUserId());
        } catch (Exception e) {
            log.error("Failed to process account locked email for user {}: {}", event.getUserId(), e.getMessage());
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for user {}: {}", event.getUserId(), nackException.getMessage());
            }
        }
    }
}
