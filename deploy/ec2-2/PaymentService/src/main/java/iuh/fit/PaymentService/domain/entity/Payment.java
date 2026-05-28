package iuh.fit.PaymentService.domain.entity;

import iuh.fit.PaymentService.domain.enums.PaymentMethod;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "payments", indexes = {
    @Index(name = "idx_payment_status", columnList = "status"),
    @Index(name = "idx_payment_expires_at", columnList = "expires_at"),
    @Index(name = "idx_payment_checkout_order_id", columnList = "checkout_order_id"),
    @Index(name = "idx_payment_order_id", columnList = "order_id")
})
@Getter
@Setter
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "checkout_order_id", nullable = false, length = 128)
    private String checkoutOrderId;

    @Column(name = "payment_code", nullable = false, unique = true, length = 50)
    private String paymentCode;

    @Column(name = "amount", nullable = false)
    private Long amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(name = "sepay_transaction_id")
    private Long sepayTransactionId;

    @Column(name = "sepay_gateway")
    private String sepayGateway;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "reconciliation_status", length = 30)
    private String reconciliationStatus;

    public Payment() {}

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
        if (status == null) {
            status = PaymentStatus.PENDING;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
