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

@Service
public class AuthServiceImpl implements AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);
    private static final SecureRandom secureRandom = new SecureRandom();

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
            String code = String.valueOf(secureRandom.nextInt(100000, 1000000));

            redisTemplate.opsForValue().set(
                    "verification:" + user.getId(),
                    code,
                    Duration.ofMinutes(5));

            VerificationEmailEvent event = new VerificationEmailEvent(
                    user.getId(),
                    user.getEmail(),
                    user.getFullName(),
                    code);

            rabbitTemplate.convertAndSend(RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.EMAIL_ROUTING_KEY, event);
            log.info("Verification email event published for user {} ({})", user.getId(), user.getEmail());
        } catch (AmqpException e) {
            log.error("Failed to publish verification event for user {}: {}", user.getId(), e.getMessage());
        }
    }

    private void persistRefreshToken(User user, String refreshToken) {
        user.setRefreshToken(refreshToken);
        user.setRefreshTokenExpiryDate(Instant.now().plusMillis(jwtUtils.getRefreshTokenExpirationMs()));
        userRepository.save(user);
    }

    @Override
    public void verifyEmail(Long userId, String verificationCode) {
        String storedCode = redisTemplate.opsForValue().get("verification:" + userId);

        if (storedCode == null) {
            throw new RuntimeException("Verification code has expired or is invalid");
        }

        if (!storedCode.equals(verificationCode)) {
            throw new RuntimeException("Verification code is incorrect");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setEmailVerification(true);
        userRepository.save(user);

        redisTemplate.delete("verification:" + userId);

        log.info("Email verified successfully for user {}", userId);
    }
}
