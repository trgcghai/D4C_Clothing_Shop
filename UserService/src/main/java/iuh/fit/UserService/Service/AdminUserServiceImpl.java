package iuh.fit.UserService.Service;

import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import iuh.fit.UserService.domain.dto.UserSummaryResponse;
import iuh.fit.UserService.domain.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;

    public AdminUserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
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
    @Transactional
    public boolean toggleUserStatus(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));

        user.setEnabled(!user.getEnabled());
        userRepository.save(user);

        return user.getEnabled();
    }

    private UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getEnabled(),
                null
        );
    }
}
