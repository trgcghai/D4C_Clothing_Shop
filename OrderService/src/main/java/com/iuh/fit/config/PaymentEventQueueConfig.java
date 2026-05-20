package com.iuh.fit.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentEventQueueConfig {

    @Bean
    public Queue paymentConfirmedQueue() {
        return QueueBuilder.durable("payment.confirmed.queue").build();
    }

    @Bean
    public Queue paymentExpiredQueue() {
        return QueueBuilder.durable("payment.expired.queue").build();
    }
}
