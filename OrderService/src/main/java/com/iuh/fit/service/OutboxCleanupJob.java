package com.iuh.fit.service;

import com.iuh.fit.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class OutboxCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(OutboxCleanupJob.class);
    private static final int RETENTION_DAYS = 30;

    private final OutboxEventRepository outboxRepository;

    public OutboxCleanupJob(OutboxEventRepository outboxRepository) {
        this.outboxRepository = outboxRepository;
    }

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupOldPublishedEvents() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(RETENTION_DAYS));
        int deleted = outboxRepository.deleteByStatusAndCreatedAtBefore("PUBLISHED", cutoff);
        if (deleted > 0) {
            log.info("Cleaned up {} published outbox events older than {} days", deleted, RETENTION_DAYS);
        }
    }

    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public void archiveOldFailedEvents() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(RETENTION_DAYS));
        int archived = outboxRepository.archiveByStatusAndCreatedAtBefore("FAILED", cutoff);
        if (archived > 0) {
            log.warn("Archived {} failed outbox events older than {} days — review needed", archived, RETENTION_DAYS);
        }
    }
}
