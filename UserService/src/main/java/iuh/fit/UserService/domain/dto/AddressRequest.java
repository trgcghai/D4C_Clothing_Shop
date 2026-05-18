package iuh.fit.UserService.domain.dto;

import lombok.Data;

@Data
public class AddressRequest {
    private String street;
    private String ward;
    private String province;
}
