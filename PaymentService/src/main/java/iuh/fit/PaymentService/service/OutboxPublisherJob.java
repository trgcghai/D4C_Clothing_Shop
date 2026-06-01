package iuh.fit.PaymentService.service;

import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
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
    private final boolean outboxEnabled;

    public OutboxPublisherJob(OutboxEventRepository outboxRepository,
                              RabbitTemplate rabbitTemplate,
                              @Value("${feature.outbox.enabled:false}") boolean outboxEnabled) {
        this.outboxRepository = outboxRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.outboxEnabled = outboxEnabled;
    }

    @Scheduled(fixedDelay = 5000)
    public void publishPendingEvents() {
        if (!outboxEnabled) {
            return;
        }

        List<OutboxEvent> events = outboxRepository.findRetryableEvents(PageRequest.of(0, BATCH_SIZE));
        if (events.isEmpty()) {
            return;
        }

        log.info("Publishing {} retryable outbox events", events.size());

        for (OutboxEvent event : events) {
            publishSingleEvent(event);
        }
    }

    @Transactional
    public void publishSingleEvent(OutboxEvent event) {
        try {
            rabbitTemplate.convertAndSend(event.getExchange(), event.getRoutingKey(), event.getPayload());
            event.setStatus("PUBLISHED");
            event.setPublishedAt(Instant.now());
            event.setRetryAfter(null);
            outboxRepository.save(event);
            log.debug("Published outbox event id={}", event.getId());
        } catch (Exception e) {
            event.setRetryCount(event.getRetryCount() + 1);
            event.setErrorMessage(e.getClass().getSimpleName() + ": " + e.getMessage());
            if (event.getRetryCount() >= event.getMaxRetries()) {
                event.setStatus("FAILED");
                outboxRepository.save(event);
                log.error("Outbox event id={} failed after {} retries: {}",
                    event.getId(), event.getRetryCount(), e.getMessage());
            } else {
                long baseDelayMs = 5000;
                long exponentialDelay = baseDelayMs * (long) Math.pow(2, event.getRetryCount() - 1);
                long jitter = java.util.concurrent.ThreadLocalRandom.current().nextLong(0, 2000);
                long totalDelayMs = Math.min(exponentialDelay + jitter, 300_000);
                event.setRetryAfter(Instant.now().plusMillis(totalDelayMs));
                outboxRepository.save(event);
                log.warn("Outbox event id={} publish failed (attempt {}/{}), retry after {}ms: {}",
                    event.getId(), event.getRetryCount(), event.getMaxRetries(), totalDelayMs, e.getMessage());
            }
        }
    }
}
