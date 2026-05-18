package iuh.fit.UserService.domain.dto;

import iuh.fit.UserService.domain.common.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private String phoneNumber;
    private String avatar;
    private String street;
    private String ward;
    private String province;
    private Role role;
}
