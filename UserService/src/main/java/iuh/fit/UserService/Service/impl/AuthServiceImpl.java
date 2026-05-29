package iuh.fit.UserService.Service.impl;

import iuh.fit.UserService.Config.JwtUtils;
import iuh.fit.UserService.Exception.AccountDisabledException;
import iuh.fit.UserService.Exception.EmailNotVerifiedException;
import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.Service.AuthService;
import iuh.fit.UserService.domain.common.Role;
import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.LoginResult;
import iuh.fit.UserService.domain.dto.JwtResponse;
import iuh.fit.UserService.domain.dto.SignupRequest;
import iuh.fit.UserService.Config.RabbitMQConfig;
import iuh.fit.UserService.domain.dto.VerificationEmailEvent;
import iuh.fit.UserService.domain.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@Service
public class AuthServiceImpl implements AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);
    private static final SecureRandom secureRandom = new SecureRandom();
    private static final String PENDING_SIGNUP_KEY_PREFIX = "pending_signup:email:";
    private static final String VERIFICATION_KEY_PREFIX = "verification:email:";
    private static final long PENDING_TTL_MINUTES = 5;

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtUtils jwtUtils;
    private final RedisTemplate<String, String> redisTemplate;
    private final RabbitTemplate rabbitTemplate;

    public AuthServiceImpl(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            PasswordEncoder encoder,
            JwtUtils jwtUtils,
            RedisTemplate<String, String> redisTemplate,
            RabbitTemplate rabbitTemplate) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.encoder = encoder;
        this.jwtUtils = jwtUtils;
        this.redisTemplate = redisTemplate;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Override
    public LoginResult login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (Boolean.FALSE.equals(user.getEmailVerification())) {
            throw new EmailNotVerifiedException(
                    "Email not verified. Please check your inbox and verify your email before signing in.");
        }

        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw new AccountDisabledException("Tài khoản đã bị vô hiệu hóa");
        }

        SecurityContextHolder.getContext().setAuthentication(authentication);

        String jwt = jwtUtils.generateToken(userDetails, user.getId(), user.getEmail());
        String refreshToken = jwtUtils.generateRefreshToken(userDetails, user.getId(), user.getEmail());

        persistRefreshToken(user, refreshToken);

        String role = userDetails.getAuthorities().iterator().next().getAuthority();

        JwtResponse jwtResponse = new JwtResponse(jwt, "Bearer", user.getId(), userDetails.getUsername(),
                user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(),
                user.getAddress() != null ? user.getAddress().getStreet() : null,
                user.getAddress() != null ? user.getAddress().getWard() : null,
                user.getAddress() != null ? user.getAddress().getProvince() : null,
                role, user.getEmailVerification());

        return new LoginResult(jwtResponse, refreshToken);
    }

    @Override
    public void register(SignupRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Error: Username is already taken!");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Error: Email is already taken!");
        }

        String pendingKey = PENDING_SIGNUP_KEY_PREFIX + request.getEmail().toLowerCase();
        if (Boolean.TRUE.equals(redisTemplate.hasKey(pendingKey))) {
            throw new RuntimeException("Error: Email already has pending verification. Please check your inbox.");
        }

        storePendingSignup(request);
        sendVerificationEmail(request);
    }

    private void storePendingSignup(SignupRequest request) {
        String key = PENDING_SIGNUP_KEY_PREFIX + request.getEmail().toLowerCase();

        redisTemplate.opsForHash().put(key, "username", request.getUsername());
        redisTemplate.opsForHash().put(key, "email", request.getEmail());
        redisTemplate.opsForHash().put(key, "fullName", request.getFullName());
        redisTemplate.opsForHash().put(key, "phoneNumber", request.getPhoneNumber());
        redisTemplate.opsForHash().put(key, "password", encoder.encode(request.getPassword()));
        redisTemplate.opsForHash().put(key, "role", request.getRole() != null ? request.getRole().name() : Role.USER.name());

        redisTemplate.expire(key, Duration.ofMinutes(PENDING_TTL_MINUTES));
    }

    private void sendVerificationEmail(SignupRequest request) {
        try {
            String code = String.valueOf(secureRandom.nextInt(100000, 1000000));

            String verificationKey = VERIFICATION_KEY_PREFIX + request.getEmail().toLowerCase();
            redisTemplate.opsForValue().set(verificationKey, code, Duration.ofMinutes(PENDING_TTL_MINUTES));

            VerificationEmailEvent event = new VerificationEmailEvent(
                    null,
                    request.getEmail(),
                    request.getFullName(),
                    code);

            rabbitTemplate.convertAndSend(RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.EMAIL_ROUTING_KEY, event);
            log.info("Verification email event published for pending signup ({})", request.getEmail());
        } catch (AmqpException e) {
            log.error("Failed to publish verification event for pending signup {}: {}", request.getEmail(), e.getMessage());
        }
    }

    private void persistRefreshToken(User user, String refreshToken) {
        user.setRefreshToken(refreshToken);
        user.setRefreshTokenExpiryDate(Instant.now().plusMillis(jwtUtils.getRefreshTokenExpirationMs()));
        userRepository.save(user);
    }

    @Override
    public void verifyEmail(String email, String verificationCode) {
        String normalizedEmail = email.toLowerCase();

        String verificationKey = VERIFICATION_KEY_PREFIX + normalizedEmail;
        String storedCode = redisTemplate.opsForValue().get(verificationKey);

        if (storedCode == null) {
            throw new RuntimeException("Verification code has expired or is invalid");
        }

        if (!storedCode.equals(verificationCode)) {
            throw new RuntimeException("Verification code is incorrect");
        }

        // Delete verification key atomically to prevent concurrent use
        redisTemplate.delete(verificationKey);

        String pendingKey = PENDING_SIGNUP_KEY_PREFIX + normalizedEmail;
        Map<Object, Object> pendingData = redisTemplate.opsForHash().entries(pendingKey);

        if (pendingData.isEmpty()) {
            throw new RuntimeException("No pending signup found for this email. Please sign up first.");
        }

        User user = new User();
        user.setUsername((String) pendingData.get("username"));
        user.setEmail(normalizedEmail);
        user.setFullName((String) pendingData.get("fullName"));
        user.setPhoneNumber((String) pendingData.get("phoneNumber"));
        user.setPassword((String) pendingData.get("password"));
        user.setRole(Role.valueOf((String) pendingData.get("role")));
        user.setEmailVerification(true);
        user.setEnabled(true);

        userRepository.save(user);

        redisTemplate.delete(pendingKey);

        log.info("Email verified and account created for user {} ({})", user.getId(), normalizedEmail);
    }
}
