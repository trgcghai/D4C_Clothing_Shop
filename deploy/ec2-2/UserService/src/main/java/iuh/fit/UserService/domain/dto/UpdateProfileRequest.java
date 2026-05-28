package iuh.fit.UserService.domain.dto;

import org.hibernate.validator.constraints.URL;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @Pattern(regexp = "^(?!\\s*$).+", message = "Full name must not be blank when provided")
    @Size(max = 100, message = "Full name must be at most 100 characters")
    private String fullName;

    @Pattern(
            regexp = "^\\+?[0-9]{9,15}$",
            message = "Phone number must be 9-15 digits and may start with +"
    )
    private String phoneNumber;

    @URL(message = "Avatar must be a valid URL")
    @Size(max = 500, message = "Avatar URL must be at most 500 characters")
    private String avatar;
}
