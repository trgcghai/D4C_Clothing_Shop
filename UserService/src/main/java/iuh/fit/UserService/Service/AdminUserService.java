package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import org.springframework.data.domain.Pageable;

public interface AdminUserService {
    PaginatedUserResponse getUsers(String q, Pageable pageable);
    boolean toggleUserStatus(Long userId);
}
