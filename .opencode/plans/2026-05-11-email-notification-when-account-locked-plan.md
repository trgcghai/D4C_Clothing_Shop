# Email Notification When Account Is Locked — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an admin locks a user account, the user receives an email notification containing the lock reason, with the reason persisted for audit.

**Architecture:** Extend the existing verification email pattern — frontend sends lock reason to UserService, which persists it and publishes an `AccountLockEvent` to RabbitMQ, consumed by NotificationService to send a Thymeleaf-rendered email.

**Tech Stack:** React + TypeScript (frontend), Spring Boot + Java 21 (UserService, NotificationService), RabbitMQ, Thymeleaf, shadcn/ui

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java` | Add `lockReason` field |
| Create | `UserService/src/main/java/iuh/fit/UserService/domain/dto/AccountLockEvent.java` | Event DTO for RabbitMQ |
| Create | `UserService/src/main/java/iuh/fit/UserService/domain/dto/ToggleUserStatusRequest.java` | Request body DTO |
| Modify | `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java` | Add `EMAIL_LOCK_ROUTING_KEY` constant |
| Modify | `UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java` | Accept request body on toggle endpoint |
| Modify | `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java` | Update interface signature |
| Modify | `UserService/src/main/java/iuh/fit/UserService/Service/impl/AdminUserServiceImpl.java` | Store reason, publish event |
| Modify | `frontend/src/services/userAdminApi.ts` | Update `toggleUserStatus` to accept `lockReason` |
| Modify | `frontend/src/hooks/useUsers.ts` | Update mutation to pass reason |
| Modify | `frontend/src/pages/admin/UserManagement.tsx` | Lock dialog with reason input + templates |
| Create | `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/AccountLockedEvent.java` | Event DTO matching producer |
| Create | `NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountLockedConsumer.java` | RabbitMQ consumer |
| Modify | `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java` | Add routing key + binding |
| Modify | `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java` | Add method signature |
| Modify | `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java` | Implement email sending |
| Create | `NotificationService/src/main/resources/templates/email/account-locked.html` | Email template |

---

### Task 1: Add `lockReason` field to User entity

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java`

- [ ] **Step 1: Add `lockReason` field to User entity**

Add a nullable `lockReason` column to the `User` entity. Place it after the `enabled` field.

```java
// In User.java, after the "enabled" field:

@Column(length = 500)
private String lockReason;
```

The full file after change:

```java
package iuh.fit.UserService.domain.entity;

import iuh.fit.UserService.domain.common.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    private String fullName;

    private String phoneNumber;

    private String avatar;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    private Role role;

    @Column(length = 1000)
    private String refreshToken;

    private Instant refreshTokenExpiryDate;

    @Column(nullable = false)
    private Boolean emailVerification = false;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(length = 500)
    private String lockReason;

    private Instant createdAt = Instant.now();
}
```

- [ ] **Step 2: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java
git commit -m "feat: add lockReason field to User entity"
```

---

### Task 2: Create AccountLockEvent DTO and RabbitMQ config update (UserService)

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/domain/dto/AccountLockEvent.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java`

- [ ] **Step 1: Create AccountLockEvent DTO**

Create `UserService/src/main/java/iuh/fit/UserService/domain/dto/AccountLockEvent.java`:

```java
package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccountLockEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String lockReason;
    private Instant timestamp;
}
```

- [ ] **Step 2: Add routing key constant to RabbitMQConfig**

Modify `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java` — add the constant after `EMAIL_ROUTING_KEY`:

```java
public static final String EMAIL_ROUTING_KEY = "email.verification";
public static final String EMAIL_LOCK_ROUTING_KEY = "email.account.locked";
```

Full file after change:

```java
package iuh.fit.UserService.Config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String EMAIL_ROUTING_KEY = "email.verification";
    public static final String EMAIL_LOCK_ROUTING_KEY = "email.account.locked";

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Message not confirmed. Cause: {}", cause);
            }
        });
        template.setReturnsCallback(returned -> log.warn("Message returned: exchange={}, routingKey={}, replyCode={}",
                returned.getExchange(), returned.getRoutingKey(), returned.getReplyCode()));
        return template;
    }
}
```

- [ ] **Step 3: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/AccountLockEvent.java \
  UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java
git commit -m "feat: add AccountLockEvent DTO and lock routing key"
```

---

### Task 3: Create ToggleUserStatusRequest DTO

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/domain/dto/ToggleUserStatusRequest.java`

- [ ] **Step 1: Create the request DTO**

Create `UserService/src/main/java/iuh/fit/UserService/domain/dto/ToggleUserStatusRequest.java`:

```java
package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ToggleUserStatusRequest {
    private String lockReason;
}
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/ToggleUserStatusRequest.java
git commit -m "feat: add ToggleUserStatusRequest DTO"
```

---

### Task 4: Update AdminUserService interface and implementation

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/impl/AdminUserServiceImpl.java`

- [ ] **Step 1: Update AdminUserService interface**

Replace the entire file `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java`:

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import org.springframework.data.domain.Pageable;

public interface AdminUserService {
    PaginatedUserResponse getUsers(String q, Pageable pageable);
    boolean willBeEnabled(Long userId);
    boolean toggleUserStatus(Long userId, String lockReason);
}
```

- [ ] **Step 2: Update AdminUserServiceImpl**

Replace the entire file `UserService/src/main/java/iuh/fit/UserService/Service/impl/AdminUserServiceImpl.java`:

```java
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
```

- [ ] **Step 3: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java \
  UserService/src/main/java/iuh/fit/UserService/Service/impl/AdminUserServiceImpl.java
git commit -m "feat: update toggleUserStatus to accept lockReason and publish event"
```

---

### Task 5: Update AdminUserController to accept request body

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java`

- [ ] **Step 1: Update the controller**

Replace the entire file `UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java`:

```java
package iuh.fit.UserService.Controller;

import iuh.fit.UserService.Service.AdminUserService;
import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import iuh.fit.UserService.domain.dto.ToggleUserStatusRequest;
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
            @ApiResponse(responseCode = "400", description = "Bad request - lockReason required when locking"),
            @ApiResponse(responseCode = "404", description = "User not found"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden - Admin only")
    })
    public ResponseEntity<Map<String, Object>> toggleUserStatus(
            @PathVariable Long id,
            @RequestBody(required = false) ToggleUserStatusRequest request
    ) {
        boolean willBeEnabled = adminUserService.willBeEnabled(id);

        if (!willBeEnabled) {
            if (request == null || request.getLockReason() == null || request.getLockReason().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "lockReason is required when locking an account"
                ));
            }
        }

        String lockReason = request != null ? request.getLockReason() : null;
        boolean enabled = adminUserService.toggleUserStatus(id, lockReason);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "enabled", enabled
        ));
    }
}
```

- [ ] **Step 2: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java
git commit -m "feat: update toggle endpoint to accept and validate lockReason"
```

---

### Task 6: Update frontend — API service layer

**Files:**
- Modify: `frontend/src/services/userAdminApi.ts`

- [ ] **Step 1: Update toggleUserStatus to accept lockReason**

Replace the entire file `frontend/src/services/userAdminApi.ts`:

```ts
import axiosInstance from "./_axios";
import { Role } from "./authApi";

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  enabled: boolean;
  avatar?: string;
  createdAt: string;
}

export interface PaginatedUsersResponse {
  data: UserSummary[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface UserFilters {
  q?: string;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface ToggleStatusResponse {
  success: boolean;
  enabled: boolean;
}

export interface ToggleUserStatusPayload {
  lockReason?: string;
}

/**
 * GET /api/admin/users
 * Get a paginated list of users with optional search.
 */
export const getUsers = async (
  params?: UserFilters,
): Promise<PaginatedUsersResponse> => {
  return axiosInstance.get("/api/admin/users", { params }).then((res) => res.data);
};

/**
 * PATCH /api/admin/users/{userId}/toggle-status
 * Toggle a user's enabled status.
 * When locking, lockReason is required.
 */
export const toggleUserStatus = async (
  userId: number,
  payload?: ToggleUserStatusPayload,
): Promise<ToggleStatusResponse> => {
  return axiosInstance
    .patch(`/api/admin/users/${userId}/toggle-status`, payload)
    .then((res) => res.data);
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/userAdminApi.ts
git commit -m "feat: update toggleUserStatus API to accept lockReason payload"
```

---

### Task 7: Update frontend — useUsers hook

**Files:**
- Modify: `frontend/src/hooks/useUsers.ts`

- [ ] **Step 1: Update the mutation to pass lockReason**

Replace the entire file `frontend/src/hooks/useUsers.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, toggleUserStatus, type UserFilters, type ToggleUserStatusPayload } from "../services/userAdminApi";

export const userKeys = {
  all: ["admin-users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
};

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters ?? {}),
    queryFn: () => getUsers(filters),
    staleTime: 30_000,
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { userId: number; payload?: ToggleUserStatusPayload }) =>
      toggleUserStatus(vars.userId, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useUsers.ts
git commit -m "feat: update useToggleUserStatus to accept payload with lockReason"
```

---

### Task 8: Update frontend — UserManagement lock dialog

**Files:**
- Modify: `frontend/src/pages/admin/UserManagement.tsx`

- [ ] **Step 1: Replace UserManagement.tsx with enhanced lock dialog**

Replace the entire file `frontend/src/pages/admin/UserManagement.tsx`:

```tsx
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Shield, ShieldOff, Users } from "lucide-react";
import { useUsers, useToggleUserStatus } from "@/src/hooks/useUsers";
import ProductPagination from "@/src/components/CustomPagination";
import { toast } from "sonner";

const PAGE_SIZE = 10;

const LOCK_REASON_TEMPLATES = [
  { label: "Vi phạm quy định cộng đồng", value: "Vi phạm quy định cộng đồng" },
  { label: "Spam hoặc quảng cáo không mong muốn", value: "Spam hoặc quảng cáo không mong muốn" },
  { label: "Tài khoản giả mạo", value: "Tài khoản giả mạo" },
  { label: "Khác (nhập lý do)", value: "" },
];

export default function UserManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [disableUserId, setDisableUserId] = useState<number | null>(null);
  const [disableUserName, setDisableUserName] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const { data, isLoading } = useUsers({
    q: debouncedSearch || undefined,
    page,
    size: PAGE_SIZE,
    sort_by: "createdAt",
    sort_order: "desc",
  });

  const toggleMutation = useToggleUserStatus();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggle = (userId: number, enabled: boolean, fullName: string) => {
    if (enabled) {
      setDisableUserId(userId);
      setDisableUserName(fullName);
      setLockReason("");
      setSelectedTemplate("");
    } else {
      toggleMutation.mutate(
        { userId },
        {
          onSuccess: () => {
            toast.success("Đã mở khóa tài khoản");
          },
          onError: () => {
            toast.error("Có lỗi xảy ra, vui lòng thử lại");
          },
        },
      );
    }
  };

  const confirmDisable = () => {
    if (disableUserId !== null && lockReason.trim()) {
      toggleMutation.mutate(
        {
          userId: disableUserId,
          payload: { lockReason: lockReason.trim() },
        },
        {
          onSuccess: () => {
            toast.success("Đã khóa tài khoản");
          },
          onError: () => {
            toast.error("Có lỗi xảy ra, vui lòng thử lại");
          },
          onSettled: () => {
            setDisableUserId(null);
            setDisableUserName("");
            setLockReason("");
            setSelectedTemplate("");
          },
        },
      );
    }
  };

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    const template = LOCK_REASON_TEMPLATES.find((t) => t.value === value);
    if (template) {
      setLockReason(template.value);
    }
  };

  const users = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" />
            Quản lý người dùng
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} người dùng
          </p>
        </div>
      </div>

      <div className="mb-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm theo tên, username, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-15">Avatar</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-30">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  Không có người dùng nào
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.fullName}
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                        {user.fullName?.charAt(0).toUpperCase() ||
                          user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.fullName || "---"}
                  </TableCell>
                  <TableCell className="text-sm">{user.username}</TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {user.role === "ADMIN" ? "Admin" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.enabled ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {user.enabled ? "Hoạt động" : "Bị khóa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={user.enabled ? "destructive" : "outline"}
                      size="sm"
                      onClick={() =>
                        handleToggle(
                          user.id,
                          user.enabled,
                          user.fullName || user.username,
                        )
                      }
                      disabled={toggleMutation.isPending}
                    >
                      {user.enabled ? (
                        <>
                          <ShieldOff className="mr-1.5 size-3.5" />
                          Khóa
                        </>
                      ) : (
                        <>
                          <Shield className="mr-1.5 size-3.5" />
                          Mở khóa
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Dialog
        open={disableUserId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDisableUserId(null);
            setDisableUserName("");
            setLockReason("");
            setSelectedTemplate("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Xác nhận khóa tài khoản</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn khóa tài khoản "{disableUserName}"? Người
              dùng này sẽ không thể đăng nhập.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lock-reason-template">
                Chọn lý do khóa tài khoản
              </Label>
              <Select
                value={selectedTemplate}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger id="lock-reason-template">
                  <SelectValue placeholder="Chọn một lý do..." />
                </SelectTrigger>
                <SelectContent>
                  {LOCK_REASON_TEMPLATES.map((template) => (
                    <SelectItem key={template.value} value={template.value}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lock-reason">
                Lý do chi tiết <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="lock-reason"
                placeholder="Nhập lý do khóa tài khoản..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                rows={3}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDisableUserId(null);
                setDisableUserName("");
                setLockReason("");
                setSelectedTemplate("");
              }}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDisable}
              disabled={!lockReason.trim() || toggleMutation.isPending}
            >
              Khóa tài khoản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/UserManagement.tsx
git commit -m "feat: add lock reason input with templates to confirm dialog"
```

---

### Task 9: Create AccountLockedEvent DTO and RabbitMQ binding (NotificationService)

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/AccountLockedEvent.java`
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java`

- [ ] **Step 1: Create AccountLockedEvent DTO**

Create `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/AccountLockedEvent.java`:

```java
package iuh.fit.notificationservice.Domain.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccountLockedEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String lockReason;
    private Instant timestamp;
}
```

- [ ] **Step 2: Add routing key and binding to RabbitMQConfig**

Replace the entire file `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java`:

```java
package iuh.fit.notificationservice.Config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class RabbitMQConfig {

    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String EMAIL_QUEUE = "email.notifications";
    public static final String EMAIL_ROUTING_KEY = "email.verification";
    public static final String EMAIL_LOCK_ROUTING_KEY = "email.account.locked";
    public static final String DLX_EXCHANGE = "email.dlx";
    public static final String DLQ_QUEUE = "email.notifications.dlq";
    public static final String DLQ_ROUTING_KEY = "dlq";

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public TopicExchange emailExchange() {
        return new TopicExchange(EMAIL_EXCHANGE);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(DLX_EXCHANGE);
    }

    @Bean
    public Queue emailNotificationsQueue() {
        return QueueBuilder.durable(EMAIL_QUEUE)
                .withArguments(Map.of(
                        "x-queue-type", "quorum",
                        "x-dead-letter-exchange", DLX_EXCHANGE,
                        "x-dead-letter-routing-key", DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ_QUEUE)
                .withArguments(Map.of("x-queue-type", "quorum"))
                .build();
    }

    @Bean
    public Binding emailBinding(Queue emailNotificationsQueue, TopicExchange emailExchange) {
        return BindingBuilder.bind(emailNotificationsQueue)
                .to(emailExchange)
                .with(EMAIL_ROUTING_KEY);
    }

    @Bean
    public Binding accountLockedBinding(Queue emailNotificationsQueue, TopicExchange emailExchange) {
        return BindingBuilder.bind(emailNotificationsQueue)
                .to(emailExchange)
                .with(EMAIL_LOCK_ROUTING_KEY);
    }

    @Bean
    public Binding dlqBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue)
                .to(deadLetterExchange)
                .with(DLQ_ROUTING_KEY);
    }
}
```

- [ ] **Step 3: Verify compilation**

Run from `NotificationService/`:
```bash
./gradlew compileJava
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/AccountLockedEvent.java \
  NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java
git commit -m "feat: add AccountLockedEvent DTO and RabbitMQ binding"
```

---

### Task 10: Create AccountLockedConsumer

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountLockedConsumer.java`

- [ ] **Step 1: Create the consumer class**

Create `NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountLockedConsumer.java`:

```java
package iuh.fit.notificationservice.Service;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Config.RabbitMQConfig;
import iuh.fit.notificationservice.Domain.DTO.AccountLockedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class AccountLockedConsumer {

    private static final Logger log = LoggerFactory.getLogger(AccountLockedConsumer.class);

    private final NotificationService notificationService;

    public AccountLockedConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitMQConfig.EMAIL_QUEUE)
    public void handleAccountLockedEmail(
            AccountLockedEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            log.info("Received account locked email event for user {}", event.getUserId());
            notificationService.sendAccountLockedEmail(event);
            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed account locked email for user {}", event.getUserId());
        } catch (Exception e) {
            log.error("Failed to process account locked email for user {}: {}", event.getUserId(), e.getMessage());
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for user {}: {}", event.getUserId(), nackException.getMessage());
            }
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountLockedConsumer.java
git commit -m "feat: add AccountLockedConsumer for RabbitMQ"
```

---

### Task 11: Add sendAccountLockedEmail to NotificationService

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java`
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java`

- [ ] **Step 1: Add method signature to interface**

Replace the entire file `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java`:

```java
package iuh.fit.notificationservice.Service;

import iuh.fit.notificationservice.Domain.DTO.AccountLockedEvent;
import iuh.fit.notificationservice.Domain.DTO.NotificationResponse;
import iuh.fit.notificationservice.Domain.DTO.SendNotificationRequest;
import iuh.fit.notificationservice.Domain.DTO.SendVerificationEmailRequest;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;

public interface NotificationService {

    NotificationResponse sendNotification(SendNotificationRequest request);

    NotificationResponse sendVerificationEmail(SendVerificationEmailRequest request);

    void sendVerificationEmail(VerificationEmailEvent event);

    void sendAccountLockedEmail(AccountLockedEvent event);
}
```

- [ ] **Step 2: Implement the method in NotificationServiceImpl**

Replace the entire file `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java`:

```java
package iuh.fit.notificationservice.Service;

import iuh.fit.notificationservice.Domain.DTO.AccountLockedEvent;
import iuh.fit.notificationservice.Domain.DTO.NotificationResponse;
import iuh.fit.notificationservice.Domain.DTO.SendNotificationRequest;
import iuh.fit.notificationservice.Domain.DTO.SendVerificationEmailRequest;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;
import iuh.fit.notificationservice.Domain.Entity.Notification;
import iuh.fit.notificationservice.Domain.Enum.NotificationStatus;
import iuh.fit.notificationservice.Domain.Enum.NotificationType;
import iuh.fit.notificationservice.Domain.Enum.NotificationProvider;
import iuh.fit.notificationservice.Repository.NotificationRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    private final NotificationRepository notificationRepository;
    private final EmailTemplateService emailTemplateService;
    private final JavaMailSender mailSender;

    public NotificationServiceImpl(
            NotificationRepository notificationRepository,
            EmailTemplateService emailTemplateService,
            JavaMailSender mailSender) {
        this.notificationRepository = notificationRepository;
        this.emailTemplateService = emailTemplateService;
        this.mailSender = mailSender;
    }

    @Override
    public NotificationResponse sendNotification(SendNotificationRequest request) {
        Notification notification = Notification.builder()
                .userId(request.getUserId())
                .type(request.getType())
                .subject(request.getSubject() != null ? request.getSubject() : "")
                .channel(request.getChannel())
                .status(NotificationStatus.PENDING)
                .templateName(request.getTemplateName())
                .templateVars(request.getTemplateVars() != null ? request.getTemplateVars() : java.util.Map.of())
                .provider(request.getProvider())
                .scheduledAt(request.getScheduledAt())
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render(
                    request.getTemplateName(),
                    request.getTemplateVars()
            );

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(request.getRecipientEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Email sent successfully to {} for user {}", request.getRecipientEmail(), request.getUserId());

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getRecipientEmail())
                    .status(NotificationStatus.SENT)
                    .message("Email sent successfully")
                    .build();

        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", request.getRecipientEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getRecipientEmail())
                    .status(NotificationStatus.FAILED)
                    .message("Failed to send email: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public NotificationResponse sendVerificationEmail(SendVerificationEmailRequest request) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", request.getUserName());
        templateVars.put("verificationCode", request.getVerificationCode());

        Notification notification = Notification.builder()
                .userId(request.getUserId())
                .type(NotificationType.WELCOME)
                .subject("Xác thực email - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("email-verification")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("email-verification", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(request.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Verification email sent to {} for user {}", request.getEmail(), request.getUserId());

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getEmail())
                    .status(NotificationStatus.SENT)
                    .message("Verification email sent successfully")
                    .build();

        } catch (MessagingException e) {
            log.error("Failed to send verification email to {}: {}", request.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getEmail())
                    .status(NotificationStatus.FAILED)
                    .message("Failed to send verification email: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public void sendVerificationEmail(VerificationEmailEvent event) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", event.getFullName());
        templateVars.put("verificationCode", event.getVerificationCode());

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .type(NotificationType.WELCOME)
                .subject("Xác thực email - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("email-verification")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("email-verification", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Verification email sent to {} for user {}", event.getEmail(), event.getUserId());

        } catch (MessagingException e) {
            log.error("Failed to send verification email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send verification email", e);
        }
    }

    @Override
    public void sendAccountLockedEmail(AccountLockedEvent event) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", event.getFullName() != null ? event.getFullName() : "bạn");
        templateVars.put("lockReason", event.getLockReason());
        templateVars.put("lockedAt", event.getTimestamp() != null
                ? event.getTimestamp().toString()
                : java.time.Instant.now().toString());

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .type(iuh.fit.notificationservice.Domain.Enum.NotificationType.ACCOUNT_ALERT)
                .subject("Thông báo: Tài khoản của bạn đã bị khóa - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("account-locked")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("account-locked", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Account locked email sent to {} for user {}", event.getEmail(), event.getUserId());

        } catch (MessagingException e) {
            log.error("Failed to send account locked email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send account locked email", e);
        }
    }
}
```

- [ ] **Step 3: Verify compilation**

Run from `NotificationService/`:
```bash
./gradlew compileJava
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java \
  NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java
git commit -m "feat: add sendAccountLockedEmail method to NotificationService"
```

---

### Task 12: Create account-locked email template

**Files:**
- Create: `NotificationService/src/main/resources/templates/email/account-locked.html`

- [ ] **Step 1: Create the email template**

Create `NotificationService/src/main/resources/templates/email/account-locked.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tài khoản bị khóa - D4C Clothing Shop</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">D4C Clothing Shop</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #dc2626; margin: 0 0 16px 0; font-size: 20px;">
                                Tài khoản của bạn đã bị khóa
                            </h2>
                            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                                Chào <span th:text="${userName}">bạn</span>,
                            </p>
                            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                                Chúng tôi regretfully thông báo rằng tài khoản của bạn tại D4C Clothing Shop đã bị khóa bởi quản trị viên hệ thống.
                            </p>

                            <!-- Lock Reason -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto; width: 100%;">
                                <tr>
                                    <td style="background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px; padding: 16px 20px;">
                                        <p style="color: #dc2626; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Lý do khóa</p>
                                        <p style="color: #555555; font-size: 14px; margin: 0; line-height: 1.6;" th:text="${lockReason}">---</p>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
                                Thời gian khóa: <span th:text="${lockedAt}">---</span>
                            </p>

                            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
                                Nếu bạn cho rằng đây là một nhầm lẫn, vui lòng liên hệ với quản trị viên hệ thống để được hỗ trợ.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 24px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="color: #888888; font-size: 12px; margin: 0;">
                                Email này được gửi tự động từ D4C Clothing Shop. Vui lòng không trả lời email này.
                            </p>
                            <p style="color: #888888; font-size: 12px; margin: 8px 0 0 0;">
                                &copy; 2026 D4C Clothing Shop. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add NotificationService/src/main/resources/templates/email/account-locked.html
git commit -m "feat: add account-locked email template"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Build all services**

```bash
cd UserService && ./mvnw compile -q && cd ..
cd NotificationService && ./gradlew compileJava && cd ..
cd frontend && npx tsc --noEmit && cd ..
```

Expected: All compile without errors.

- [ ] **Step 2: Final commit**

```bash
git status
```

Verify all changes are committed.

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Lock dialog has required reason input | Task 8 |
| Dialog displays predefined templates | Task 8 |
| Selecting template auto-fills reason | Task 8 |
| Users can edit auto-filled reason | Task 8 |
| Submit without reason not allowed | Task 8 |
| API accepts lockReason | Task 5 |
| API rejects missing/empty lockReason | Task 5 |
| API stores lock reason | Task 4 |
| RabbitMQ event produced after lock | Task 4 |
| Event contains email + reason | Task 2 |
| Notification service consumes event | Task 10 |
| Email sent to locked user | Task 11 |
| Email contains lock reason | Task 12 |
| lockReason persisted on User entity | Task 1 |

## Placeholder Scan

No TBDs, TODOs, or incomplete sections. All code is fully written. All types are consistent across DTOs. Method signatures match between interfaces and implementations.
