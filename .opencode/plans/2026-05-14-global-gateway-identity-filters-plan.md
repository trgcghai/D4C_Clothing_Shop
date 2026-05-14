# Global Gateway Identity Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global `GatewayIdentityFilter` to UserService, CartService, and OrderService that validates `X-User-Id` header exists (returning 401 if missing), with admin role checks on admin paths (returning 403 if not ADMIN), following the same pattern as PaymentService's existing filter.

**Architecture:** Each service gets a `OncePerRequestFilter` that checks every incoming request against a path whitelist. Non-whitelisted paths require `X-User-Id` header. Admin paths additionally require `X-User-Roles` containing `ADMIN`. UserService's existing `GatewayAuthHeaderFilter` is merged into the new filter (validate + populate SecurityContext in one pass).

**Tech Stack:** Spring Boot 3.3.1, Java 21, Spring Security `OncePerRequestFilter`

---

## File Map

| File | Service | Action |
|------|---------|--------|
| `Config/GatewayIdentityFilter.java` | UserService | Replace existing `GatewayAuthHeaderFilter.java` |
| `Config/SecurityConfig.java` | UserService | Update to use new filter |
| `security/GatewayIdentityFilter.java` | CartService | Create new |
| `security/SecurityConfig.java` | CartService | Wire new filter |
| `security/GatewayIdentityFilter.java` | OrderService | Create new |
| `security/SecurityConfig.java` | OrderService | Wire new filter |

---

## Task 1: UserService — Merge GatewayAuthHeaderFilter into GatewayIdentityFilter

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/GatewayIdentityFilter.java`
- Delete: `UserService/src/main/java/iuh/fit/UserService/Config/GatewayAuthHeaderFilter.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/SecurityConfig.java`

- [ ] **Step 1: Create GatewayIdentityFilter**

This replaces `GatewayAuthHeaderFilter`. It validates `X-User-Id` exists AND populates `SecurityContext` in one pass.

```java
package iuh.fit.UserService.Config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class GatewayIdentityFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/auth/",
            "/.well-known/jwks.json",
            "/v3/api-docs/",
            "/swagger-ui/",
            "/actuator/"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (PUBLIC_PATHS.stream().anyMatch(path::startsWith)) {
            filterChain.doFilter(request, response);
            return;
        }

        String userId = request.getHeader("X-User-Id");

        if (userId == null || userId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Missing authentication\"}");
            return;
        }

        String username = request.getHeader("X-User-Username");
        String rolesHeader = request.getHeader("X-User-Roles");

        if (username != null && !username.isBlank()) {
            List<SimpleGrantedAuthority> authorities = Arrays.stream(rolesHeader.split(","))
                    .filter(role -> !role.isBlank())
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(username, null, authorities);

            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }
}
```

- [ ] **Step 2: Delete old GatewayAuthHeaderFilter**

Delete: `UserService/src/main/java/iuh/fit/UserService/Config/GatewayAuthHeaderFilter.java`

- [ ] **Step 3: Update SecurityConfig**

Replace the entire `SecurityConfig.java`:

```java
package iuh.fit.UserService.Config;

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

    private final UserDetailsService userDetailsService;
    private final GatewayIdentityFilter gatewayIdentityFilter;

    public SecurityConfig(UserDetailsService userDetailsService,
                          GatewayIdentityFilter gatewayIdentityFilter) {
        this.userDetailsService = userDetailsService;
        this.gatewayIdentityFilter = gatewayIdentityFilter;
    }

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
                .addFilterBefore(gatewayIdentityFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth ->
                        auth.requestMatchers("/api/auth/**").permitAll()
                                .requestMatchers("/.well-known/jwks.json").permitAll()
                                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                                .requestMatchers("/api/admin/**").hasAuthority("ADMIN")
                                .anyRequest().authenticated()
                );

        return http.build();
    }
}
```

- [ ] **Step 4: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add UserService/
git commit -m "feat(UserService): replace GatewayAuthHeaderFilter with GatewayIdentityFilter"
```

---

## Task 2: CartService — Add GatewayIdentityFilter

**Files:**
- Create: `CartService/src/main/java/iuh/fit/CartService/security/GatewayIdentityFilter.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/security/SecurityConfig.java`

- [ ] **Step 1: Create GatewayIdentityFilter**

```java
package iuh.fit.CartService.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class GatewayIdentityFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/v3/api-docs/",
            "/swagger-ui/",
            "/actuator/"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (PUBLIC_PATHS.stream().anyMatch(path::startsWith)) {
            filterChain.doFilter(request, response);
            return;
        }

        String userId = request.getHeader("X-User-Id");

        if (userId == null || userId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Missing authentication\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
```

- [ ] **Step 2: Update SecurityConfig**

Replace the entire `SecurityConfig.java`:

```java
package iuh.fit.CartService.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final GatewayIdentityFilter gatewayIdentityFilter;

    public SecurityConfig(GatewayIdentityFilter gatewayIdentityFilter) {
        this.gatewayIdentityFilter = gatewayIdentityFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(gatewayIdentityFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/health").permitAll()
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}
```

- [ ] **Step 3: Verify compilation**

Run from `CartService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add CartService/
git commit -m "feat(CartService): add GatewayIdentityFilter"
```

---

## Task 3: OrderService — Add GatewayIdentityFilter with Admin Role Check

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/security/GatewayIdentityFilter.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/security/SecurityConfig.java`

- [ ] **Step 1: Create GatewayIdentityFilter**

This follows the same pattern as Api-Gateway's `AdminRoleFilter` — checks `/api/admin/**` paths for ADMIN role.

```java
package com.iuh.fit.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class GatewayIdentityFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/public/",
            "/v3/api-docs/",
            "/swagger-ui/",
            "/actuator/"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (PUBLIC_PATHS.stream().anyMatch(path::startsWith)) {
            filterChain.doFilter(request, response);
            return;
        }

        String userId = request.getHeader("X-User-Id");

        if (userId == null || userId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Missing authentication\"}");
            return;
        }

        if (path.startsWith("/api/admin/")) {
            String rolesHeader = request.getHeader("X-User-Roles");
            if (rolesHeader == null || !rolesHeader.contains("ADMIN")) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Forbidden\",\"message\":\"Admin access required\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
```

- [ ] **Step 2: Update SecurityConfig**

Replace the entire `SecurityConfig.java`:

```java
package com.iuh.fit.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final GatewayIdentityFilter gatewayIdentityFilter;

    public SecurityConfig(GatewayIdentityFilter gatewayIdentityFilter) {
        this.gatewayIdentityFilter = gatewayIdentityFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(gatewayIdentityFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/health", "/api/public/**").permitAll()
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}
```

- [ ] **Step 3: Verify compilation**

Run from `OrderService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add OrderService/
git commit -m "feat(OrderService): add GatewayIdentityFilter with admin role check"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Build all three services**

```bash
cd UserService && ./mvnw clean compile -q && cd ..
cd CartService && ./mvnw clean compile -q && cd ..
cd OrderService && ./mvnw clean compile -q && cd ..
```

Expected: All BUILD SUCCESS

- [ ] **Step 2: Commit all remaining changes**

```bash
git add .
git commit -m "refactor: global gateway identity filters across all services"
```

---

## Testing Strategy

**Manual testing** is the primary verification method.

Test matrix per service:

| Test | UserService | CartService | OrderService |
|------|-------------|-------------|--------------|
| Public path (no header) → 200 | `/api/auth/signin` | `/actuator/health` | `/api/public/orders/...` |
| Protected path (no header) → 401 | `/api/users/me` | `/api/cart` | `/api/orders` |
| Protected path (with header) → 200 | `/api/users/me` + `X-User-Id` | `/api/cart` + `X-User-Id` | `/api/orders` + `X-User-Id` |
| Admin path (no admin role) → 403 | `/api/admin/users` + `X-User-Roles: USER` | N/A | `/api/orders/admin` + `X-User-Roles: USER` |
| Admin path (with admin role) → 200 | `/api/admin/users` + `X-User-Roles: ADMIN` | N/A | `/api/orders/admin` + `X-User-Roles: ADMIN` |
