package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private String type = "Bearer";
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private String phoneNumber;
    private String avatar;
    private String role;
    private String refreshToken;

    public JwtResponse(String token, String type, Long id, String username, String email, String fullName, String phoneNumber, String avatar, String role, String refreshToken) {
        this.token = token;
        this.type = type;
        this.id = id;
        this.username = username;
        this.email = email;
        this.fullName = fullName;
        this.phoneNumber = phoneNumber;
        this.avatar = avatar;
        this.role = role;
        this.refreshToken = refreshToken;
    }
}
