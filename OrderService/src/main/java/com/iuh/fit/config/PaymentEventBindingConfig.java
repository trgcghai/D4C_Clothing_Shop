package com.iuh.fit.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentEventBindingConfig {

    public static final String PAYMENT_EXCHANGE = "payment.exchange";
    public static final String PAYMENT_CONFIRMED_ROUTING_KEY = "payment.confirmed";
    public static final String PAYMENT_EXPIRED_ROUTING_KEY = "payment.expired";
    public static final String PAYMENT_CANCELLED_ROUTING_KEY = "payment.cancelled";
    public static final String PAYMENT_DLX_EXCHANGE = "payment.dlx";
    public static final String PAYMENT_CONFIRMED_DLQ_ROUTING_KEY = "payment.confirmed.dlq";
    public static final String PAYMENT_EXPIRED_DLQ_ROUTING_KEY = "payment.expired.dlq";
    public static final String PAYMENT_CANCELLED_DLQ_ROUTING_KEY = "payment.cancelled.dlq";

    @Bean
    public TopicExchange paymentExchange() {
        return new TopicExchange(PAYMENT_EXCHANGE);
    }

    @Bean
    public TopicExchange paymentDlxExchange() {
        return new TopicExchange(PAYMENT_DLX_EXCHANGE);
    }

    @Bean
    public Binding paymentConfirmedBinding(
            Queue paymentConfirmedQueue,
            TopicExchange paymentExchange) {
        return BindingBuilder.bind(paymentConfirmedQueue)
                .to(paymentExchange)
                .with(PAYMENT_CONFIRMED_ROUTING_KEY);
    }

    @Bean
    public Binding paymentExpiredBinding(
            Queue paymentExpiredQueue,
            TopicExchange paymentExchange) {
        return BindingBuilder.bind(paymentExpiredQueue)
                .to(paymentExchange)
                .with(PAYMENT_EXPIRED_ROUTING_KEY);
    }

    @Bean
    public Binding paymentCancelledBinding(
            Queue paymentCancelledQueue,
            TopicExchange paymentExchange) {
        return BindingBuilder.bind(paymentCancelledQueue)
                .to(paymentExchange)
                .with(PAYMENT_CANCELLED_ROUTING_KEY);
    }

    @Bean
    public Binding paymentConfirmedDlqBinding(
            Queue paymentConfirmedDlq,
            TopicExchange paymentDlxExchange) {
        return BindingBuilder.bind(paymentConfirmedDlq)
                .to(paymentDlxExchange)
                .with(PAYMENT_CONFIRMED_DLQ_ROUTING_KEY);
    }

    @Bean
    public Binding paymentExpiredDlqBinding(
            Queue paymentExpiredDlq,
            TopicExchange paymentDlxExchange) {
        return BindingBuilder.bind(paymentExpiredDlq)
                .to(paymentDlxExchange)
                .with(PAYMENT_EXPIRED_DLQ_ROUTING_KEY);
    }

    @Bean
    public Binding paymentCancelledDlqBinding(
            Queue paymentCancelledDlq,
            TopicExchange paymentDlxExchange) {
        return BindingBuilder.bind(paymentCancelledDlq)
                .to(paymentDlxExchange)
                .with(PAYMENT_CANCELLED_DLQ_ROUTING_KEY);
    }
}
