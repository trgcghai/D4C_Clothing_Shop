package com.iuh.fit.service;

import com.iuh.fit.domain.entity.OutboxEvent;
import com.iuh.fit.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class OutboxPublisherJob {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherJob.class);
    private static final int BATCH_SIZE = 100;

    private final OutboxEventRepository outboxRepository;
    private final RabbitTemplate rabbitTemplate;

    @Value("${feature.outbox.enabled:false}")
    private boolean outboxEnabled;

    public OutboxPublisherJob(OutboxEventRepository outboxRepository, RabbitTemplate rabbitTemplate) {
        this.outboxRepository = outboxRepository;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void publishPendingEvents() {
        if (!outboxEnabled) return;

        List<OutboxEvent> events = outboxRepository.findPendingEvents(PageRequest.of(0, BATCH_SIZE));
        if (events.isEmpty()) return;

        log.info("Publishing {} pending outbox events", events.size());

        for (OutboxEvent event : events) {
            try {
                rabbitTemplate.convertAndSend(event.getExchange(), event.getRoutingKey(), event.getPayload());
                event.setStatus("PUBLISHED");
                event.setPublishedAt(Instant.now());
                outboxRepository.save(event);
                log.debug("Published outbox event id={}", event.getId());
            } catch (Exception e) {
                event.setRetryCount(event.getRetryCount() + 1);
                event.setErrorMessage(e.getMessage());
                if (event.getRetryCount() >= event.getMaxRetries()) {
                    event.setStatus("FAILED");
                    outboxRepository.save(event);
                    log.error("Outbox event id={} failed after {} retries: {}",
                        event.getId(), event.getRetryCount(), e.getMessage());
                } else {
                    outboxRepository.save(event);
                    log.warn("Outbox event id={} publish failed (attempt {}/{}): {}",
                        event.getId(), event.getRetryCount(), event.getMaxRetries(), e.getMessage());
                }
            }
        }
    }
}
