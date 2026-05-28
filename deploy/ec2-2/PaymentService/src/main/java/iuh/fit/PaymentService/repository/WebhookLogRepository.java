package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.WebhookLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WebhookLogRepository extends JpaRepository<WebhookLog, Long> {

    Optional<WebhookLog> findByTransactionId(Long transactionId);
}
