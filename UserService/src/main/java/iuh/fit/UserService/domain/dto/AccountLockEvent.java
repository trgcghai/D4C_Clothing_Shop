package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccountLockEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String lockReason;
    private Instant timestamp;
}
