package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.JwtResponse;
import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.SignupRequest;

public interface AuthService {
    JwtResponse login(LoginRequest request);
    void register(SignupRequest request);
}
