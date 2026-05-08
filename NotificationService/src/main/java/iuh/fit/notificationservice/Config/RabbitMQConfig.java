package iuh.fit.notificationservice.Config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class RabbitMQConfig {

    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String EMAIL_QUEUE = "email.notifications";
    public static final String EMAIL_ROUTING_KEY = "email.verification";
    public static final String DLX_EXCHANGE = "email.dlx";
    public static final String DLQ_QUEUE = "email.notifications.dlq";
    public static final String DLQ_ROUTING_KEY = "dlq";

    @Bean
    public TopicExchange emailExchange() {
        return new TopicExchange(EMAIL_EXCHANGE);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(DLX_EXCHANGE);
    }

    @Bean
    public Queue emailNotificationsQueue() {
        return QueueBuilder.durable(EMAIL_QUEUE)
                .withArguments(Map.of(
                        "x-queue-type", "quorum",
                        "x-dead-letter-exchange", DLX_EXCHANGE,
                        "x-dead-letter-routing-key", DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ_QUEUE)
                .withArguments(Map.of("x-queue-type", "quorum"))
                .build();
    }

    @Bean
    public Binding emailBinding(Queue emailNotificationsQueue, TopicExchange emailExchange) {
        return BindingBuilder.bind(emailNotificationsQueue)
                .to(emailExchange)
                .with(EMAIL_ROUTING_KEY);
    }

    @Bean
    public Binding dlqBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue)
                .to(deadLetterExchange)
                .with(DLQ_ROUTING_KEY);
    }
}
