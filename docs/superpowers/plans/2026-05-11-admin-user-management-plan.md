# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin UI and API for viewing, searching, and disabling/enabling users with server-side pagination.

**Architecture:** New `AdminUserController` in UserService with role-based security. Frontend adds `UserManagement` page under existing admin layout, following the same table + pagination pattern as `ProductManagement`.

**Tech Stack:** Spring Boot 3 (Java), JPA/MariaDB, React + Vite, TanStack Query, shadcn/ui, Zustand.

---

### Task 1: Add `enabled` field to User entity

**Files:**

- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java`

- [ ] **Step 1: Add `enabled` field to User entity**

Add after the `emailVerification` field:

```java
    @Column(nullable = false)
    private Boolean enabled = true;
```

Full file after change:

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
}
```

- [ ] **Step 2: Create database migration for the new column**

Create migration file or let JPA auto-update handle it. Since the project uses JPA with `spring.jpa.hibernate.ddl-auto=update` (check `UserService/src/main/resources/application.properties` or `application.yml`), Hibernate will auto-add the column. If using Flyway/Liquibase, create a migration. For this project, JPA auto-ddl is sufficient.

Verify by checking the config:

```bash
cat UserService/src/main/resources/application.properties
# or
cat UserService/src/main/resources/application.yml
```

If `spring.jpa.hibernate.ddl-auto` is `update` or `create`, no migration needed. If it's `none` or `validate`, add a SQL migration or change to `update`.

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java
git commit -m "feat(user): add enabled field to User entity"
```

---

### Task 2: Create `AccountDisabledException` and handler

**Files:**

- Create: `UserService/src/main/java/iuh/fit/UserService/Exception/AccountDisabledException.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/Exception/GlobalExceptionHandler.java`

- [ ] **Step 1: Create `AccountDisabledException`**

```java
package iuh.fit.UserService.Exception;

public class AccountDisabledException extends RuntimeException {
    public AccountDisabledException(String message) {
        super(message);
    }
}
```

- [ ] **Step 2: Add handler to `GlobalExceptionHandler`**

Add a new handler method and a helper method for 403 responses. Add these methods to the existing class:

```java
    @ExceptionHandler(AccountDisabledException.class)
    public ResponseEntity<Map<String, Object>> handleAccountDisabledException(AccountDisabledException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now());
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }
```

Full `GlobalExceptionHandler.java` after change:

```java
package iuh.fit.UserService.Exception;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));

        return buildBadRequest("Validation failed", errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolationException(ConstraintViolationException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(violation ->
                errors.put(violation.getPropertyPath().toString(), violation.getMessage())
        );

        return buildBadRequest("Validation failed", errors);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
        return buildBadRequest(ex.getMessage(), null);
    }

    @ExceptionHandler(AccountDisabledException.class)
    public ResponseEntity<Map<String, Object>> handleAccountDisabledException(AccountDisabledException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now());
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    private ResponseEntity<Map<String, Object>> buildBadRequest(String message, Map<String, String> errors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("message", message);
        if (errors != null && !errors.isEmpty()) {
            body.put("errors", errors);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Exception/AccountDisabledException.java UserService/src/main/java/iuh/fit/UserService/Exception/GlobalExceptionHandler.java
git commit -m "feat(auth): add AccountDisabledException and 403 handler"
```

---

### Task 3: Update login flow to check `enabled` status

**Files:**

- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`

- [ ] **Step 1: Add `enabled` check in `login()` method**

In the `login()` method, after the `emailVerification` check and before `SecurityContextHolder.getContext().setAuthentication(authentication)`, add:

```java
        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw new AccountDisabledException("Tài khoản đã bị vô hiệu hóa");
        }
```

Also add the import at the top:

```java
import iuh.fit.UserService.Exception.AccountDisabledException;
```

The updated `login()` method:

```java
    @Override
    public LoginResult login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (Boolean.FALSE.equals(user.getEmailVerification())) {
            throw new EmailNotVerifiedException("Email not verified. Please check your inbox and verify your email before signing in.");
        }

        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw new AccountDisabledException("Tài khoản đã bị vô hiệu hóa");
        }

        SecurityContextHolder.getContext().setAuthentication(authentication);

        String jwt = jwtUtils.generateToken(userDetails);
        String refreshToken = jwtUtils.generateRefreshToken(userDetails);

        persistRefreshToken(user, refreshToken);

        String role = userDetails.getAuthorities().iterator().next().getAuthority();

        JwtResponse jwtResponse = new JwtResponse(jwt, "Bearer", user.getId(), userDetails.getUsername(),
                user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(), role, user.getEmailVerification());

        return new LoginResult(jwtResponse, refreshToken);
    }
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java
git commit -m "feat(auth): block disabled users from signing in"
```

---

### Task 4: Create DTOs for admin user responses

**Files:**

- Create: `UserService/src/main/java/iuh/fit/UserService/domain/dto/UserSummaryResponse.java`
- Create: `UserService/src/main/java/iuh/fit/UserService/domain/dto/PaginatedUserResponse.java`

- [ ] **Step 1: Create `UserSummaryResponse.java`**

```java
package iuh.fit.UserService.domain.dto;

import iuh.fit.UserService.domain.common.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;

@Data
@AllArgsConstructor
public class UserSummaryResponse {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private Role role;
    private Boolean enabled;
    private Instant createdAt;
}
```

- [ ] **Step 2: Create `PaginatedUserResponse.java`**

```java
package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class PaginatedUserResponse {
    private List<UserSummaryResponse> data;
    private long total;
    private int page;
    private int size;
    private int totalPages;
}
```

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/UserSummaryResponse.java UserService/src/main/java/iuh/fit/UserService/domain/dto/PaginatedUserResponse.java
git commit -m "feat(admin): add UserSummaryResponse and PaginatedUserResponse DTOs"
```

---

### Task 5: Add search query to UserRepository

**Files:**

- Modify: `UserService/src/main/java/iuh/fit/UserService/Repository/UserRepository.java`

- [ ] **Step 1: Add search method to UserRepository**

Add the search method. Full file after change:

```java
package iuh.fit.UserService.Repository;

import iuh.fit.UserService.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Boolean existsByUsername(String username);
    Boolean existsByEmail(String email);
    Optional<User> findByEmail(String email);

    Page<User> findByFullNameContainingIgnoreCaseOrUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(
            String fullName, String username, String email, Pageable pageable
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Repository/UserRepository.java
git commit -m "feat(admin): add user search query to UserRepository"
```

---

### Task 6: Create AdminUserService interface and implementation

**Files:**

- Create: `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java`
- Create: `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserServiceImpl.java`

- [ ] **Step 1: Create `AdminUserService.java` interface**

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import org.springframework.data.domain.Pageable;

public interface AdminUserService {
    PaginatedUserResponse getUsers(String q, Pageable pageable);
    boolean toggleUserStatus(Long userId);
}
```

- [ ] **Step 2: Create `AdminUserServiceImpl.java`**

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.domain.dto.PaginatedUserResponse;
import iuh.fit.UserService.domain.dto.UserSummaryResponse;
import iuh.fit.UserService.domain.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

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
    public boolean toggleUserStatus(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));

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
```

Note: `createdAt` is passed as `null` since the User entity doesn't have it yet. The `createdAt` field will be added in a later task if needed. For now, the frontend won't display it.

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java UserService/src/main/java/iuh/fit/UserService/Service/AdminUserServiceImpl.java
git commit -m "feat(admin): add AdminUserService with list and toggle status"
```

---

### Task 7: Create AdminUserController

**Files:**

- Create: `UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java`

- [ ] **Step 1: Create `AdminUserController.java`**

```java
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
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(direction, sort_by));

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
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java
git commit -m "feat(admin): add AdminUserController with list and toggle endpoints"
```

---

### Task 8: Update SecurityConfig to protect admin endpoints

**Files:**

- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/SecurityConfig.java`

- [ ] **Step 1: Add admin role check to SecurityConfig**

Add `.requestMatchers("/api/admin/**").hasRole("ADMIN")` before `.anyRequest().authenticated()`.

Full file after change:

```java
package iuh.fit.UserService.Config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private UserDetailsService userDetailsService;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .authenticationProvider(authenticationProvider())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth ->
                        auth.requestMatchers("/api/auth/**").permitAll()
                                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                                .anyRequest().authenticated()
                );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Config/SecurityConfig.java
git commit -m "feat(security): protect admin endpoints with ADMIN role"
```

---

### Task 9: Create frontend API layer for user management

**Files:**

- Create: `frontend/src/services/userAdminApi.ts`

- [ ] **Step 1: Create `userAdminApi.ts`**

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

export const getUsers = async (
  params?: UserFilters,
): Promise<PaginatedUsersResponse> => {
  return axiosInstance
    .get("/api/admin/users", { params })
    .then((res) => res.data);
};

export const toggleUserStatus = async (
  userId: number,
): Promise<ToggleStatusResponse> => {
  return axiosInstance
    .patch(`/api/admin/users/${userId}/toggle-status`)
    .then((res) => res.data);
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/userAdminApi.ts
git commit -m "feat(frontend): add user admin API service"
```

---

### Task 10: Create frontend hooks for user management

**Files:**

- Create: `frontend/src/hooks/useUsers.ts`

- [ ] **Step 1: Create `useUsers.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUsers,
  toggleUserStatus,
  type UserFilters,
} from "../services/userAdminApi";

export const userKeys = {
  all: ["admin-users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
};

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => getUsers(filters),
    staleTime: 30_000,
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => toggleUserStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useUsers.ts
git commit -m "feat(frontend): add useUsers and useToggleUserStatus hooks"
```

---

### Task 11: Create UserManagement page

**Files:**

- Create: `frontend/src/pages/admin/UserManagement.tsx`

- [ ] **Step 1: Create `UserManagement.tsx`**

```tsx
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Shield, ShieldOff, Users } from "lucide-react";
import { useUsers, useToggleUserStatus } from "@/src/hooks/useUsers";
import ProductPagination from "@/src/components/CustomPagination";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export default function UserManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [disableUserId, setDisableUserId] = useState<number | null>(null);
  const [disableUserName, setDisableUserName] = useState("");

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
    } else {
      toggleMutation.mutate(userId, {
        onSuccess: () => {
          toast.success("Đã mở khóa tài khoản");
        },
      });
    }
  };

  const confirmDisable = () => {
    if (disableUserId !== null) {
      toggleMutation.mutate(disableUserId, {
        onSuccess: () => {
          toast.success("Đã khóa tài khoản");
        },
        onSettled: () => {
          setDisableUserId(null);
          setDisableUserName("");
        },
      });
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

      <AlertDialog
        open={disableUserId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDisableUserId(null);
            setDisableUserName("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận khóa tài khoản</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn khóa tài khoản "{disableUserName}"? Người
              dùng này sẽ không thể đăng nhập.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Khóa tài khoản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/UserManagement.tsx
git commit -m "feat(frontend): add UserManagement page with search, pagination, and toggle"
```

---

### Task 12: Add route and sidebar navigation

**Files:**

- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/layouts/AdminLayout.tsx`

- [ ] **Step 1: Add route in `App.tsx`**

Add import:

```tsx
import UserManagement from "./pages/admin/UserManagement";
```

Add route under AdminLayout children:

```tsx
{ path: "/admin/users", element: <UserManagement /> },
```

Full `App.tsx` after change:

```tsx
import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import AdminLayout from "./layouts/AdminLayout";

import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Signin from "./pages/Signin";
import VerifyEmail from "./pages/VerifyEmail";
import Profile from "./pages/Profile";
import ProductsPage from "./pages/ProductsPage";
import Admin from "./pages/Admin";
import ProductDetail from "./pages/ProductDetail";
import ProductManagement from "./pages/admin/ProductManagement";
import CategoryManagement from "./pages/admin/CategoryManagement";
import UserManagement from "./pages/admin/UserManagement";
import { Toaster } from "@/components/ui/sonner";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/products", element: <ProductsPage /> },
      { path: "/products/:productId", element: <ProductDetail /> },
      { path: "/profile", element: <Profile /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/signin", element: <Signin /> },
      { path: "/signup", element: <Signup /> },
      { path: "/verify-email", element: <VerifyEmail /> },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: "/admin", element: <Admin /> },
      { path: "/admin/products", element: <ProductManagement /> },
      { path: "/admin/categories", element: <CategoryManagement /> },
      { path: "/admin/users", element: <UserManagement /> },
    ],
  },
  {
    path: "*",
    element: <h1>Page Not Found</h1>,
  },
]);

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 2: Add nav item in `AdminLayout.tsx`**

Add `Users` to lucide-react import:

```tsx
import { Package, LayoutGrid, Users } from "lucide-react";
```

Add to `navItems` array:

```tsx
{ to: "/admin/users", label: "Quản lý người dùng", icon: Users },
```

Full `AdminLayout.tsx` after change:

```tsx
import {
  Navigate,
  Outlet,
  useLocation,
  Link,
  useNavigate,
} from "react-router-dom";
import { useStore } from "../store";
import { cn } from "../lib/utils";
import { Package, LayoutGrid, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/src/hooks/useAuth";

const navItems = [
  { to: "/admin/products", label: "Quản lý sản phẩm", icon: Package },
  { to: "/admin/categories", label: "Quản lý danh mục", icon: LayoutGrid },
  { to: "/admin/users", label: "Quản lý người dùng", icon: Users },
];

const AdminLayout = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const role = useStore((state) => state.role);
  const location = useLocation();
  const { mutate: signOut } = useSignOut();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut(undefined, {
      onSuccess: () => {
        navigate("/", { replace: true });
      },
    });
  };

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-muted/30">
        <div className="flex h-14 items-center border-b px-6">
          <Link to="/admin" className="text-lg font-bold">
            D4C Admin
          </Link>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                location.pathname.startsWith(to)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 w-full px-4">
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="w-full"
          >
            Đăng xuất
          </Button>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/layouts/AdminLayout.tsx
git commit -m "feat(frontend): add user management route and sidebar nav"
```

---

### Task 13: Verify and test

- [ ] **Step 1: Verify UserService compiles**

```bash
cd UserService && ./mvnw compile -q
```

Expected: BUILD SUCCESS (no errors)

- [ ] **Step 2: Verify frontend builds**

```bash
cd frontend && npm run build
```

Expected: Build completes without errors

- [ ] **Step 3: Run frontend lint**

```bash
cd frontend && npm run lint
```

Expected: No lint errors

- [ ] **Step 4: Manual test checklist**

1. Start UserService, ensure DB has the `enabled` column added
2. Login as admin, navigate to `/admin/users`
3. Verify table shows all users with correct columns
4. Type in search bar — results filter after ~300ms debounce
5. Click pagination — page changes, API called with correct page param
6. Click "Khóa" on an enabled user — confirmation dialog appears
7. Confirm disable — user status changes to "Bị khóa", toast shows success
8. Click "Mở khóa" on a disabled user — no confirmation, status changes immediately
9. Try logging in as a disabled user — should see 403 error message
10. Login as non-admin — should be redirected away from `/admin/users`
