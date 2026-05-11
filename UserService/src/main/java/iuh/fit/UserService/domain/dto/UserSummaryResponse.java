package iuh.fit.UserService.domain.dto;

import iuh.fit.UserService.domain.common.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserSummaryResponse {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private Role role;
    private Boolean enabled;
    private String avatar;
}
