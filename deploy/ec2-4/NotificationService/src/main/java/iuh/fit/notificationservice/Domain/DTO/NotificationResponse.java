package iuh.fit.notificationservice.Domain.DTO;

import iuh.fit.notificationservice.Domain.Enum.NotificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponse {

    private String id;
    private Long userId;
    private String recipientEmail;
    private NotificationStatus status;
    private String message;
}
