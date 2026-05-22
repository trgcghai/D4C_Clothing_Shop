package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'PENDING' ORDER BY e.createdAt ASC")
    List<OutboxEvent> findPendingEvents(Pageable pageable);

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'FAILED' ORDER BY e.createdAt ASC")
    List<OutboxEvent> findFailedEvents(Pageable pageable);
}
