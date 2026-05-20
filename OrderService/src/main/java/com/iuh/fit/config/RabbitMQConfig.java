package com.iuh.fit.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String ORDER_CREATED_ROUTING_KEY = "email.order.created";
    public static final String ORDER_PAID_ROUTING_KEY = "email.order.paid";
    public static final String ORDER_CANCELLED_ROUTING_KEY = "email.order.cancelled";

    public static final String ORDER_EXCHANGE = "order.exchange";
    public static final String ORDER_CANCELLED_EVENT_ROUTING_KEY = "order.cancelled";
    public static final String ORDER_PAID_EVENT_ROUTING_KEY = "order.paid";

    @Bean
    public TopicExchange emailExchange() {
        return new TopicExchange(EMAIL_EXCHANGE);
    }

    @Bean
    public TopicExchange orderExchange() {
        return new TopicExchange(ORDER_EXCHANGE);
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Message not confirmed. Cause: {}", cause);
            }
        });
        template.setReturnsCallback(returned -> log.warn("Message returned: exchange={}, routingKey={}, replyCode={}",
                returned.getExchange(), returned.getRoutingKey(), returned.getReplyCode()));
        return template;
    }
}
