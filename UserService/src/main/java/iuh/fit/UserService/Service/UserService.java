package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.ChangePasswordRequest;
import iuh.fit.UserService.domain.dto.UpdateProfileRequest;
import iuh.fit.UserService.domain.dto.AddressRequest;
import iuh.fit.UserService.domain.dto.UserResponse;
import org.springframework.web.multipart.MultipartFile;

public interface UserService {
    UserResponse getCurrentUser(String username);
    UserResponse updateProfile(String username, UpdateProfileRequest request);
    String changePassword(String username, ChangePasswordRequest request);
    UserResponse uploadAvatar(String username, MultipartFile file);
    UserResponse updateAddress(String username, AddressRequest request);
}
