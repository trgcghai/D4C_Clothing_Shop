package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'PENDING' " +
           "AND (e.retryAfter IS NULL OR e.retryAfter <= CURRENT_TIMESTAMP) " +
           "ORDER BY e.createdAt ASC")
    List<OutboxEvent> findRetryableEvents(Pageable pageable);

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'FAILED' ORDER BY e.createdAt ASC")
    List<OutboxEvent> findFailedEvents(Pageable pageable);

    @Modifying
    @Query("DELETE FROM OutboxEvent e WHERE e.status = :status AND e.createdAt < :cutoff")
    int deleteByStatusAndCreatedAtBefore(@Param("status") String status, @Param("cutoff") Instant cutoff);

    @Modifying
    @Query("UPDATE OutboxEvent e SET e.status = 'ARCHIVED' WHERE e.status = :status AND e.createdAt < :cutoff")
    int archiveByStatusAndCreatedAtBefore(@Param("status") String status, @Param("cutoff") Instant cutoff);
}
