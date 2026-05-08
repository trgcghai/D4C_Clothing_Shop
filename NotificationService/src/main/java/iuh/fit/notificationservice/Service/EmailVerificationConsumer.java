package iuh.fit.notificationservice.Service;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Config.RabbitMQConfig;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class EmailVerificationConsumer {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationConsumer.class);

    private final NotificationService notificationService;

    public EmailVerificationConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitMQConfig.EMAIL_QUEUE)
    public void handleVerificationEmail(
            VerificationEmailEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            log.info("Received verification email event for user {}", event.getUserId());
            notificationService.sendVerificationEmail(event);
            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed verification email for user {}", event.getUserId());
        } catch (Exception e) {
            log.error("Failed to process verification email for user {}: {}", event.getUserId(), e.getMessage());
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for user {}: {}", event.getUserId(), nackException.getMessage());
            }
        }
    }
}
