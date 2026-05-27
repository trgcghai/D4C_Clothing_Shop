package iuh.fit.PaymentService.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "webhook_logs")
@Getter
@Setter
public class WebhookLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", nullable = false, unique = true)
    private Long transactionId;

    @Column(columnDefinition = "JSON")
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public WebhookLog() {}

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}
