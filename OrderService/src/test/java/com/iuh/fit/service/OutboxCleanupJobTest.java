package com.iuh.fit.service;

import com.iuh.fit.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxCleanupJobTest {

    @Mock private OutboxEventRepository outboxRepository;

    @Test
    void shouldDeleteOldPublishedEvents() {
        OutboxCleanupJob job = new OutboxCleanupJob(outboxRepository);
        when(outboxRepository.deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), any(Instant.class))).thenReturn(2);

        job.cleanupOldPublishedEvents();

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(outboxRepository).deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), cutoffCaptor.capture());
        Instant cutoff = cutoffCaptor.getValue();
        assertThat(cutoff).isBefore(Instant.now().minus(Duration.ofDays(29)));
    }

    @Test
    void shouldArchiveOldFailedEvents() {
        OutboxCleanupJob job = new OutboxCleanupJob(outboxRepository);
        when(outboxRepository.archiveByStatusAndCreatedAtBefore(eq("FAILED"), any(Instant.class))).thenReturn(1);

        job.archiveOldFailedEvents();

        verify(outboxRepository).archiveByStatusAndCreatedAtBefore(eq("FAILED"), any(Instant.class));
    }

    @Test
    void shouldNotDeleteWhenNoOldEvents() {
        OutboxCleanupJob job = new OutboxCleanupJob(outboxRepository);
        when(outboxRepository.deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), any(Instant.class))).thenReturn(0);

        job.cleanupOldPublishedEvents();

        verify(outboxRepository).deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), any(Instant.class));
    }
}
