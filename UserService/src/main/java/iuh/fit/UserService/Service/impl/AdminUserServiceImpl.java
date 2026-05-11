package iuh.fit.UserService.Service.impl;

import iuh.fit.UserService.Config.RabbitMQConfig;
import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.Service.AdminUserService;
import iuh.fit.UserService.domain.common.Role;
import iuh.fit.UserService.domain.dto.AccountLockEvent;
import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import iuh.fit.UserService.domain.dto.UserSummaryResponse;
import iuh.fit.UserService.domain.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class AdminUserServiceImpl implements AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserServiceImpl.class);

    private final UserRepository userRepository;
    private final RabbitTemplate rabbitTemplate;

    public AdminUserServiceImpl(UserRepository userRepository, RabbitTemplate rabbitTemplate) {
        this.userRepository = userRepository;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Override
    public PaginatedUserResponse getUsers(String q, Pageable pageable) {
        Page<User> userPage;

        if (q == null || q.trim().isEmpty()) {
            userPage = userRepository.findAll(pageable);
        } else {
            String search = q.trim();
            userPage = userRepository.findByFullNameContainingIgnoreCaseOrUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(
                    search, search, search, pageable
            );
        }

        var summaries = userPage.getContent().stream()
                .map(this::toSummary)
                .toList();

        return new PaginatedUserResponse(
                summaries,
                userPage.getTotalElements(),
                userPage.getNumber() + 1,
                userPage.getSize(),
                userPage.getTotalPages()
        );
    }

    @Override
    public boolean willBeEnabled(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));
        return !user.getEnabled();
    }

    @Override
    @Transactional
    public boolean toggleUserStatus(Long userId, String lockReason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));

        // Prevent disabling admin accounts
        if (user.getRole() != null && user.getRole() == Role.ADMIN && user.getEnabled()) {
            throw new RuntimeException("Cannot disable admin accounts");
        }

        boolean willBeEnabled = !user.getEnabled();

        if (!willBeEnabled) {
            // Locking account — require and store reason
            if (lockReason == null || lockReason.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lock reason is required");
            }
            user.setLockReason(lockReason);
        } else {
            // Unlocking account — clear reason
            user.setLockReason(null);
        }

        user.setEnabled(willBeEnabled);
        userRepository.save(user);

        // Publish event when account is locked
        if (!willBeEnabled && lockReason != null && !lockReason.isBlank()) {
            publishAccountLockedEvent(user);
        }

        return user.getEnabled();
    }

    private void publishAccountLockedEvent(User user) {
        try {
            AccountLockEvent event = new AccountLockEvent(
                    user.getId(),
                    user.getEmail(),
                    user.getFullName(),
                    user.getLockReason(),
                    Instant.now()
            );

            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EMAIL_EXCHANGE,
                    RabbitMQConfig.EMAIL_LOCK_ROUTING_KEY,
                    event
            );
            log.info("Account locked event published for user {} ({})", user.getId(), user.getEmail());
        } catch (AmqpException e) {
            log.error("Failed to publish account locked event for user {}: {}", user.getId(), e.getMessage());
        }
    }

    private UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getEnabled(),
                user.getAvatar(),
                user.getCreatedAt()
        );
    }
}
