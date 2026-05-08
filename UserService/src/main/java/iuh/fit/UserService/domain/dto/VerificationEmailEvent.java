package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerificationEmailEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String verificationCode;
}
