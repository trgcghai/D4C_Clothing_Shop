package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByPaymentCode(String paymentCode);

    Optional<Payment> findByCheckoutOrderId(String checkoutOrderId);

    Optional<Payment> findByOrderId(Long orderId);

    Page<Payment> findByStatus(PaymentStatus status, Pageable pageable);

    @Modifying
    @Query("UPDATE Payment p SET p.status = 'PAID', p.sepayTransactionId = :sepayTxId, " +
           "p.sepayGateway = :gateway, p.paidAt = :paidAt " +
           "WHERE p.paymentCode = :paymentCode AND p.status = 'PENDING'")
    int markAsPaid(@Param("paymentCode") String paymentCode,
                   @Param("sepayTxId") Long sepayTxId,
                   @Param("gateway") String gateway,
                   @Param("paidAt") Instant paidAt);

    @Modifying
    @Query("UPDATE Payment p SET p.status = 'CANCELLED' WHERE p.id = :id AND p.status = 'PENDING'")
    int cancelPayment(@Param("id") Long paymentId);

    @Modifying
    @Query("UPDATE Payment p SET p.status = 'EXPIRED' WHERE p.status = 'PENDING' AND p.expiresAt <= :now")
    int expirePendingPayments(@Param("now") Instant now);

    @Query("SELECT p FROM Payment p WHERE p.status = 'PENDING' AND p.amount = :amount")
    java.util.List<Payment> findPendingByAmount(@Param("amount") Long amount);
}
