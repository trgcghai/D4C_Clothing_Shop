package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendVerificationEmailRequest {
    private Long userId;
    private String userName;
    private String email;
    private String verificationCode;
}
