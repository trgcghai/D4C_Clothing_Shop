package iuh.fit.notificationservice.Domain.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusEvent {
    private String type;
    private Long orderId;
    private Long userId;
    private String email;
}
