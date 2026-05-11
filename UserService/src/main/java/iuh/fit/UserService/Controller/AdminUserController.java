package iuh.fit.UserService.Controller;

import iuh.fit.UserService.Service.AdminUserService;
import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
@Tag(name = "admin-users", description = "Admin user management APIs")
@SecurityRequirement(name = "bearerAuth")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    @Operation(summary = "List users with pagination and search")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Paginated user list"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden - Admin only")
    })
    public ResponseEntity<PaginatedUserResponse> getUsers(
            @Parameter(description = "Search query (fullName, username, email)")
            @RequestParam(required = false, defaultValue = "") String q,
            @Parameter(description = "Page number (1-indexed)")
            @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Page size")
            @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field")
            @RequestParam(defaultValue = "createdAt") String sort_by,
            @Parameter(description = "Sort direction")
            @RequestParam(defaultValue = "desc") String sort_order
    ) {
        Sort.Direction direction = "asc".equalsIgnoreCase(sort_order) ? Sort.Direction.ASC : Sort.Direction.DESC;

        int cappedSize = Math.min(size, 100);

        List<String> allowedSortFields = List.of("createdAt", "username", "email", "fullName");
        if (!allowedSortFields.contains(sort_by)) {
            sort_by = "createdAt";
        }

        PageRequest pageRequest = PageRequest.of(page - 1, cappedSize, Sort.by(direction, sort_by));

        return ResponseEntity.ok(adminUserService.getUsers(q, pageRequest));
    }

    @PatchMapping("/{id}/toggle-status")
    @Operation(summary = "Toggle user enabled status")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Status toggled successfully"),
            @ApiResponse(responseCode = "404", description = "User not found"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden - Admin only")
    })
    public ResponseEntity<Map<String, Object>> toggleUserStatus(
            @PathVariable Long id
    ) {
        boolean enabled = adminUserService.toggleUserStatus(id);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "enabled", enabled
        ));
    }
}
