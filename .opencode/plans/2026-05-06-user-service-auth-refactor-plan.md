# UserService: Auth Service Extraction + Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract login/signup logic into AuthService, add emailVerification field to User, and send verification email via NotificationService with Redis-stored code after signup.

**Architecture:** Thin AuthController delegates to AuthService interface. AuthServiceImpl handles authentication, user creation, Redis code storage, and NotificationService HTTP call. Redis stores 6-digit verification codes with 5-min TTL.

**Tech Stack:** Spring Boot 3.3.1, Java 21, Maven, Redis (spring-boot-starter-data-redis), RestTemplate, MariaDB, Lombok

---

### Task 1: Add Redis Dependency and Config

**Files:**
- Modify: `UserService/pom.xml`
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/RedisConfig.java`
- Modify: `UserService/src/main/resources/application.properties`
- Modify: `UserService/.env`
- Modify: `UserService/.env.example`

- [ ] **Step 1: Add Redis dependency to pom.xml**

Add this dependency inside the `<dependencies>` section of `UserService/pom.xml` (after the `mariadb-java-client` dependency):

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

- [ ] **Step 2: Create RedisConfig.java**

Create `UserService/src/main/java/iuh/fit/UserService/Config/RedisConfig.java`:

```java
package iuh.fit.UserService.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        return template;
    }
}
```

- [ ] **Step 3: Add Redis and Notification Service config to application.properties**

Append to `UserService/src/main/resources/application.properties`:

```properties
# Redis
spring.data.redis.host=${REDIS_HOST:localhost}
spring.data.redis.port=${REDIS_PORT:6379}

# Notification Service
notification.service.url=${NOTIFICATION_SERVICE_URL:http://notificationservice:8083}
```

- [ ] **Step 4: Update .env**

Append to `UserService/.env`:

```
REDIS_HOST=redis
REDIS_PORT=6379
NOTIFICATION_SERVICE_URL=http://notificationservice:8083
```

- [ ] **Step 5: Update .env.example**

Append to `UserService/.env.example`:

```
REDIS_HOST=
REDIS_PORT=
NOTIFICATION_SERVICE_URL=
```

- [ ] **Step 6: Commit**

```bash
git add UserService/pom.xml UserService/src/main/java/iuh/fit/UserService/Config/RedisConfig.java UserService/src/main/resources/application.properties UserService/.env UserService/.env.example
git commit -m "feat: add Redis dependency and config to UserService"
```

---

### Task 2: Add emailVerification Field to User Entity

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java`

- [ ] **Step 1: Add emailVerification field**

Add this field to `User.java` (after `refreshTokenExpiryDate`):

```java
@Column(nullable = false)
private Boolean emailVerification = false;
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java
git commit -m "feat: add emailVerification field to User entity"
```

---

### Task 3: Create DTOs and Modify JwtResponse

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/domain/dto/SendVerificationEmailRequest.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/dto/JwtResponse.java`

- [ ] **Step 1: Create SendVerificationEmailRequest DTO**

Create `UserService/src/main/java/iuh/fit/UserService/domain/dto/SendVerificationEmailRequest.java`:

```java
package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendVerificationEmailRequest {
    private Long userId;
    private String userName;
    private String email;
    private String verificationCode;
}
```

- [ ] **Step 2: Add refreshToken field to JwtResponse**

Modify `UserService/src/main/java/iuh/fit/UserService/domain/dto/JwtResponse.java`. Add this field after `private String role;`:

```java
private String refreshToken;
```

Update the all-args constructor to include it:

```java
public JwtResponse(String token, String type, Long id, String username, String email, String fullName, String phoneNumber, String avatar, String role, String refreshToken) {
    this.token = token;
    this.type = type;
    this.id = id;
    this.username = username;
    this.email = email;
    this.fullName = fullName;
    this.phoneNumber = phoneNumber;
    this.avatar = avatar;
    this.role = role;
    this.refreshToken = refreshToken;
}
```

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/SendVerificationEmailRequest.java UserService/src/main/java/iuh/fit/UserService/domain/dto/JwtResponse.java
git commit -m "feat: add SendVerificationEmailRequest DTO and refreshToken to JwtResponse"
```

---

### Task 4: Create AuthService Interface and Implementation

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java`
- Create: `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`

- [ ] **Step 1: Create AuthService interface**

Create `UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java`:

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.JwtResponse;
import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.SignupRequest;

public interface AuthService {
    JwtResponse login(LoginRequest request);
    void register(SignupRequest request);
}
```

- [ ] **Step 2: Create AuthServiceImpl**

Create `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`:

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.Config.JwtUtils;
import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.domain.common.Role;
import iuh.fit.UserService.domain.dto.JwtResponse;
import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.SendVerificationEmailRequest;
import iuh.fit.UserService.domain.dto.SignupRequest;
import iuh.fit.UserService.domain.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@Service
public class AuthServiceImpl implements AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);
    private static final SecureRandom secureRandom = new SecureRandom();

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

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @Value("${notification.service.url:http://notificationservice:8083}")
    private String notificationServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public JwtResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String jwt = jwtUtils.generateToken(userDetails);
        String refreshToken = jwtUtils.generateRefreshToken(userDetails);

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        persistRefreshToken(user, refreshToken);

        String role = userDetails.getAuthorities().iterator().next().getAuthority();

        return new JwtResponse(jwt, "Bearer", user.getId(), userDetails.getUsername(),
                user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(), role, refreshToken);
    }

    @Override
    public void register(SignupRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Error: Username is already taken!");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Error: Email is already taken!");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setPassword(encoder.encode(request.getPassword()));
        user.setRole(request.getRole() != null ? request.getRole() : Role.USER);
        user.setEmailVerification(false);

        userRepository.save(user);

        sendVerificationEmail(user);
    }

    private void sendVerificationEmail(User user) {
        try {
            String code = String.valueOf(secureRandom.nextInt(100000, 999999));

            redisTemplate.opsForValue().set(
                    "verification:" + user.getId(),
                    code,
                    Duration.ofMinutes(5)
            );

            SendVerificationEmailRequest emailRequest = new SendVerificationEmailRequest(
                    user.getId(),
                    user.getFullName(),
                    user.getEmail(),
                    code
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<SendVerificationEmailRequest> entity = new HttpEntity<>(emailRequest, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    notificationServiceUrl + "/api/notifications/send-verification",
                    entity,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Verification email sent to user {} ({})", user.getId(), user.getEmail());
            } else {
                log.warn("NotificationService returned non-2xx status for user {}", user.getId());
            }
        } catch (Exception e) {
            log.error("Failed to send verification email to user {}: {}", user.getId(), e.getMessage());
        }
    }

    private void persistRefreshToken(User user, String refreshToken) {
        user.setRefreshToken(refreshToken);
        user.setRefreshTokenExpiryDate(Instant.now().plusMillis(jwtUtils.getRefreshTokenExpirationMs()));
        userRepository.save(user);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java
git commit -m "feat: create AuthService interface and implementation with Redis verification code"
```

---

### Task 5: Refactor AuthController to Use AuthService

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java`

- [ ] **Step 1: Replace AuthController content**

Replace the entire content of `UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java` with:

```java
package iuh.fit.UserService.Controller;

import iuh.fit.UserService.Config.JwtUtils;
import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.Service.AuthService;
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
        JwtResponse response = authService.login(loginRequest);

        ResponseCookie refreshCookie = buildRefreshCookie(response.getRefreshToken());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(response);
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
                        user.getRole().name(), newRefreshToken));
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
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java
git commit -m "refactor: thin AuthController delegates to AuthService"
```

---

### Task 6: Verify Build

- [ ] **Step 1: Run Maven build**

Run from `UserService/`:
```bash
./mvnw clean compile
```
Expected: BUILD SUCCESS, no compilation errors

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: address compilation issues"
```
