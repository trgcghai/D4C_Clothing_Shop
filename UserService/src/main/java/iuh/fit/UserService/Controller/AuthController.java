package iuh.fit.UserService.Controller;


import iuh.fit.UserService.Config.JwtUtils;
import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.domain.common.Role;
import iuh.fit.UserService.domain.dto.JwtResponse;
import iuh.fit.UserService.domain.dto.LoginRequest;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "auth", description = "Authentication APIs")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private UserDetailsService userDetailsService;

    // API Đăng nhập
    @PostMapping("/signin")
    @Operation(summary = "Sign in user", description = "Authenticate user and return access token. Also sets refresh token cookie.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Signed in successfully"),
            @ApiResponse(responseCode = "401", description = "Invalid credentials")
    })
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

        // 1. Xác thực username và password
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

        // 2. Lưu thông tin vào Security Context
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // 3. Tạo JWT token
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String jwt = jwtUtils.generateToken(userDetails);
        String refreshToken = jwtUtils.generateRefreshToken(userDetails);
        User user = userRepository.findByUsername(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        persistRefreshToken(user, refreshToken);

        // 4. Lấy Role (giả định User chỉ có 1 role)
        String role = userDetails.getAuthorities().iterator().next().getAuthority();

        ResponseCookie refreshCookie = buildRefreshCookie(refreshToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(new JwtResponse(jwt, user.getId(), userDetails.getUsername(), user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(), role));
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

        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        String newAccessToken = jwtUtils.generateToken(userDetails);
        String newRefreshToken = jwtUtils.generateRefreshToken(userDetails);
        persistRefreshToken(user, newRefreshToken);
        String role = userDetails.getAuthorities().iterator().next().getAuthority();

        ResponseCookie refreshCookie = buildRefreshCookie(newRefreshToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(new JwtResponse(newAccessToken, user.getId(), userDetails.getUsername(), user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(), role));
    }

    // API Đăng ký
    @PostMapping("/signup")
    @Operation(summary = "Sign up user", description = "Register a new account.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "User registered successfully"),
            @ApiResponse(responseCode = "400", description = "Username or email already exists")
    })
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
        // Kiểm tra username đã tồn tại chưa
        if (userRepository.existsByUsername(signUpRequest.getUsername())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Error: Username is already taken!"));
        }

        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Error: Email is already taken!"));
        }

        // Tạo tài khoản mới (Mật khẩu được mã hóa bằng BCrypt)
        User user = new User();
        user.setUsername(signUpRequest.getUsername());
        user.setEmail(signUpRequest.getEmail());
        user.setFullName(signUpRequest.getFullName());
        user.setPhoneNumber(signUpRequest.getPhoneNumber());
        user.setPassword(encoder.encode(signUpRequest.getPassword()));
        user.setRole(signUpRequest.getRole() != null ? signUpRequest.getRole() : Role.USER);

        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "User registered successfully!"));
    }

    // API Đăng xuất
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

    private void persistRefreshToken(User user, String refreshToken) {
        user.setRefreshToken(refreshToken);
        user.setRefreshTokenExpiryDate(Instant.now().plusMillis(jwtUtils.getRefreshTokenExpirationMs()));
        userRepository.save(user);
    }
}
