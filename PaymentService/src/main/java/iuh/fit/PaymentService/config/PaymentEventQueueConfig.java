package iuh.fit.PaymentService.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentEventQueueConfig {

    @Bean
    public TopicExchange paymentDlx() {
        return new TopicExchange("payment.dlx");
    }

    @Bean
    public Queue paymentConfirmedDlq() {
        return QueueBuilder.durable("payment.confirmed.dlq").build();
    }

    @Bean
    public Binding paymentConfirmedDlqBinding() {
        return BindingBuilder.bind(paymentConfirmedDlq()).to(paymentDlx()).with("payment.confirmed.dlq");
    }

    @Bean
    public Queue paymentExpiredDlq() {
        return QueueBuilder.durable("payment.expired.dlq").build();
    }

    @Bean
    public Binding paymentExpiredDlqBinding() {
        return BindingBuilder.bind(paymentExpiredDlq()).to(paymentDlx()).with("payment.expired.dlq");
    }

    @Bean
    public Queue paymentCancelledDlq() {
        return QueueBuilder.durable("payment.cancelled.dlq").build();
    }

    @Bean
    public Binding paymentCancelledDlqBinding() {
        return BindingBuilder.bind(paymentCancelledDlq()).to(paymentDlx()).with("payment.cancelled.dlq");
    }
}
