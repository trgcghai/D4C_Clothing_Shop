package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.LoginResult;
import iuh.fit.UserService.domain.dto.SignupRequest;

public interface AuthService {
    LoginResult login(LoginRequest request);
    void register(SignupRequest request);
    void verifyEmail(Long userId, String verificationCode);
}
