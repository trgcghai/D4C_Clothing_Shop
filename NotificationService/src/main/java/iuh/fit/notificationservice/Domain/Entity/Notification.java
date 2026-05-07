package iuh.fit.notificationservice.Domain.Entity;

import iuh.fit.notificationservice.Domain.Enum.NotificationChannel;
import iuh.fit.notificationservice.Domain.Enum.NotificationProvider;
import iuh.fit.notificationservice.Domain.Enum.NotificationStatus;
import iuh.fit.notificationservice.Domain.Enum.NotificationType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationStatus status;

    @Builder.Default
    private Integer retryCount = 0;

    private String errorMessage;

    @Column(nullable = false)
    private String templateName;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "notification_template_vars",
            joinColumns = @JoinColumn(name = "notification_id")
    )
    @MapKeyColumn(name = "var_key")
    @Column(name = "var_value", length = 2048)
    @Builder.Default
    private Map<String, String> templateVars = new HashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationProvider provider;

    private LocalDateTime scheduledAt;

    private LocalDateTime sentAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
