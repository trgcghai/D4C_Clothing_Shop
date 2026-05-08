package iuh.fit.UserService.Controller;

import iuh.fit.UserService.Config.JwtUtils;
import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.Service.AuthService;
import iuh.fit.UserService.domain.dto.JwtResponse;
import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.LoginResult;
import iuh.fit.UserService.domain.dto.SignupRequest;
import iuh.fit.UserService.domain.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "auth", description = "Authentication APIs")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final JwtUtils jwtUtils;

    public AuthController(AuthService authService, UserRepository userRepository, JwtUtils jwtUtils) {
        this.authService = authService;
        this.userRepository = userRepository;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping("/signin")
    @Operation(summary = "Sign in user", description = "Authenticate user and return access token. Also sets refresh token cookie.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Signed in successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed"),
            @ApiResponse(responseCode = "401", description = "Invalid credentials")
    })
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        LoginResult result = authService.login(loginRequest);

        ResponseCookie refreshCookie = buildRefreshCookie(result.refreshToken());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(result.jwtResponse());
    }

    @PostMapping("/refresh-token")
    @Operation(summary = "Refresh access token", description = "Read refresh token from cookie and issue a new access token + refresh token cookie.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Token refreshed successfully"),
            @ApiResponse(responseCode = "401", description = "Refresh token invalid or expired")
    })
    public ResponseEntity<?> refreshToken(HttpServletRequest request) {
        String refreshToken = extractRefreshTokenFromCookie(request);

        if (refreshToken == null || !jwtUtils.validateJwtToken(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Refresh token is invalid or expired"));
        }

        String username = jwtUtils.getUserNameFromJwtToken(refreshToken);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getRefreshToken() == null || !user.getRefreshToken().equals(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Refresh token is no longer valid"));
        }

        if (user.getRefreshTokenExpiryDate() != null && user.getRefreshTokenExpiryDate().isBefore(Instant.now())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Refresh token has expired"));
        }

        org.springframework.security.core.userdetails.UserDetails userDetails =
                org.springframework.security.core.userdetails.User.withUsername(username)
                        .password("")
                        .authorities(user.getRole().name())
                        .build();

        String newAccessToken = jwtUtils.generateToken(userDetails);
        String newRefreshToken = jwtUtils.generateRefreshToken(userDetails);

        user.setRefreshToken(newRefreshToken);
        user.setRefreshTokenExpiryDate(Instant.now().plusMillis(jwtUtils.getRefreshTokenExpirationMs()));
        userRepository.save(user);

        ResponseCookie refreshCookie = buildRefreshCookie(newRefreshToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(new JwtResponse(newAccessToken, "Bearer", user.getId(), userDetails.getUsername(),
                        user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(),
                        user.getRole().name()));
    }

    @PostMapping("/signup")
    @Operation(summary = "Sign up user", description = "Register a new account and send verification email.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "User registered successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed or username/email already exists")
    })
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
        authService.register(signUpRequest);
        return ResponseEntity.ok(Map.of("message", "User registered successfully!"));
    }

    @PostMapping("/signout")
    @Operation(summary = "Sign out user", description = "Clear refresh token in database and browser cookie.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Signed out successfully")
    })
    public ResponseEntity<?> signOut() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.isAuthenticated()) {
            String username = authentication.getName();
            userRepository.findByUsername(username).ifPresent(user -> {
                user.setRefreshToken(null);
                user.setRefreshTokenExpiryDate(null);
                userRepository.save(user);
            });
        }

        ResponseCookie clearCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/api/auth")
                .maxAge(0)
                .sameSite("Lax")
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearCookie.toString())
                .body(Map.of("message", "Dang xuat thanh cong"));
    }

    private ResponseCookie buildRefreshCookie(String refreshToken) {
        return ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(false)
                .path("/api/auth")
                .maxAge(Duration.ofMillis(jwtUtils.getRefreshTokenExpirationMs()))
                .sameSite("Lax")
                .build();
    }

    private String extractRefreshTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if ("refreshToken".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
