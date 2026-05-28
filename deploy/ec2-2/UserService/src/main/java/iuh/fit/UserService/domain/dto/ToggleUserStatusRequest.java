package iuh.fit.UserService.domain.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ToggleUserStatusRequest {
    @Size(max = 500, message = "Lock reason must not exceed 500 characters")
    private String lockReason;
}
