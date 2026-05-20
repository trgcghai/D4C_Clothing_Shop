package com.iuh.fit.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class PaymentEventQueueConfig {

    @Bean
    public Queue paymentConfirmedQueue() {
        return QueueBuilder.durable("payment.confirmed.queue")
                .withArguments(Map.of(
                        "x-dead-letter-exchange", PaymentEventBindingConfig.PAYMENT_DLX_EXCHANGE,
                        "x-dead-letter-routing-key", PaymentEventBindingConfig.PAYMENT_CONFIRMED_DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue paymentExpiredQueue() {
        return QueueBuilder.durable("payment.expired.queue")
                .withArguments(Map.of(
                        "x-dead-letter-exchange", PaymentEventBindingConfig.PAYMENT_DLX_EXCHANGE,
                        "x-dead-letter-routing-key", PaymentEventBindingConfig.PAYMENT_EXPIRED_DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue paymentCancelledQueue() {
        return QueueBuilder.durable("payment.cancelled.queue")
                .withArguments(Map.of(
                        "x-dead-letter-exchange", PaymentEventBindingConfig.PAYMENT_DLX_EXCHANGE,
                        "x-dead-letter-routing-key", PaymentEventBindingConfig.PAYMENT_CANCELLED_DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue paymentConfirmedDlq() {
        return QueueBuilder.durable("payment.confirmed.dlq").build();
    }

    @Bean
    public Queue paymentExpiredDlq() {
        return QueueBuilder.durable("payment.expired.dlq").build();
    }

    @Bean
    public Queue paymentCancelledDlq() {
        return QueueBuilder.durable("payment.cancelled.dlq").build();
    }
}
