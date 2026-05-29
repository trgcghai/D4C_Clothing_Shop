package iuh.fit.notificationservice.Domain.DTO;

import iuh.fit.notificationservice.Domain.Enum.NotificationChannel;
import iuh.fit.notificationservice.Domain.Enum.NotificationProvider;
import iuh.fit.notificationservice.Domain.Enum.NotificationType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendNotificationRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotBlank(message = "Recipient email is required")
    @Email(message = "Invalid email format")
    private String recipientEmail;

    @NotNull(message = "Notification type is required")
    private NotificationType type;

    @NotBlank(message = "Template name is required")
    private String templateName;

    @Builder.Default
    private NotificationChannel channel = NotificationChannel.EMAIL;

    @Builder.Default
    private NotificationProvider provider = NotificationProvider.SMTP;

    private String subject;

    private Map<String, String> templateVars;

    private LocalDateTime scheduledAt;
}
