package iuh.fit.UserService.domain.dto;

public record LoginResult(JwtResponse jwtResponse, String refreshToken) {
}
