package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.UnmatchedPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UnmatchedPaymentRepository extends JpaRepository<UnmatchedPayment, Long> {

    Optional<UnmatchedPayment> findBySepayTransactionId(String sepayTransactionId);

    List<UnmatchedPayment> findByResolvedFalse();
}
