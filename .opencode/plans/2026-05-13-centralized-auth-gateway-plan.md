# Centralized Auth at API Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move JWT validation from individual services to the API Gateway using RSA asymmetric keys, with Gateway forwarding user identity via `X-User-*` headers to downstream services.

**Architecture:** UserService generates RSA key pair (persisted), signs JWTs with private key, exposes JWKS endpoint. Api-Gateway fetches public key via JWKS, validates JWTs locally, strips Authorization header, injects `X-User-Id`, `X-User-Username`, `X-User-Email`, `X-User-Roles` headers. Downstream services remove JWT logic and trust Gateway headers.

**Tech Stack:** Spring Cloud Gateway (WebFlux), Spring Security, jjwt 0.12.3 with RSA, JWKS standard, Java 21, Spring Boot 3.3.1

---

## File Map

### New Files
| File | Service | Responsibility |
|------|---------|----------------|
| `Config/RsaKeyManager.java` | UserService | Generate/load/persist RSA key pair |
| `Config/JwksController.java` | UserService | Expose `/.well-known/jwks.json` endpoint |
| `config/JwtValidationFilter.java` | Api-Gateway | GlobalFilter for JWT validation + header injection |
| `config/JwksCache.java` | Api-Gateway | Fetch and cache JWKS public key from UserService |
| `config/RouteProtectionConfig.java` | Api-Gateway | Define which routes require auth |
| `config/AdminRoleFilter.java` | Api-Gateway | Filter for `/api/admin/**` role check |
| `config/JwtUtils.java` | Api-Gateway | JWT validation utility using RSA public key |

### Modified Files
| File | Service | Change |
|------|---------|--------|
| `Config/JwtUtils.java` | UserService | Switch from HMAC to RSA signing, add email claim |
| `Config/SecurityConfig.java` | UserService | Remove JwtAuthenticationFilter |
| `build.gradle` | Api-Gateway | Add jjwt dependencies |
| `application.properties` | Api-Gateway | Add JWKS URL + cache TTL config |
| `SecurityConfig.java` | CartService | Remove JWT filter, permit all |
| `SecurityConfig.java` | OrderService | Remove JWT filter, permit all |
| `SecurityConfig.java` | PaymentService | Remove JWT filter, permit all |
| `.env` + `.env.example` | UserService | Replace `JWT_SECRET` with RSA key env vars |
| `.env` + `.env.example` | Api-Gateway | Add `JWKS_URL`, `JWKS_CACHE_TTL_MS` |

### Deleted Files (per service)
| File | Service |
|------|---------|
| `security/JwtUtils.java` | CartService, OrderService, PaymentService |
| `security/JwtAuthenticationFilter.java` | CartService, OrderService, PaymentService |

---

## Phase 1: UserService — RSA Keys + JWKS Endpoint

### Task 1: Add RsaKeyManager to UserService

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/RsaKeyManager.java`

- [ ] **Step 1: Create RsaKeyManager**

This component generates an RSA-256 key pair on first startup and persists it to files. On subsequent startups, it loads the existing keys. Keys can also be provided via environment variables.

```java
package iuh.fit.UserService.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Component
public class RsaKeyManager {

    @Value("${jwt.private-key-file:config/rsa-private.pem}")
    private String privateKeyFile;

    @Value("${jwt.public-key-file:config/rsa-public.pem}")
    private String publicKeyFile;

    @Value("${jwt.private-key:}")
    private String privateKeyEnv;

    @Value("${jwt.public-key:}")
    private String publicKeyEnv;

    private PrivateKey privateKey;
    private PublicKey publicKey;

    @PostConstruct
    public void init() throws Exception {
        if (!privateKeyEnv.isBlank() && !publicKeyEnv.isBlank()) {
            loadFromEnv();
        } else if (Files.exists(Path.of(privateKeyFile)) && Files.exists(Path.of(publicKeyFile))) {
            loadFromFiles();
        } else {
            generateAndPersist();
        }
    }

    private void loadFromEnv() throws Exception {
        privateKey = parsePrivateKey(privateKeyEnv);
        publicKey = parsePublicKey(publicKeyEnv);
    }

    private void loadFromFiles() throws Exception {
        String privPem = Files.readString(Path.of(privateKeyFile));
        String pubPem = Files.readString(Path.of(publicKeyFile));
        privateKey = parsePrivateKey(privPem);
        publicKey = parsePublicKey(pubPem);
    }

    private void generateAndPersist() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair keyPair = keyGen.generateKeyPair();
        privateKey = keyPair.getPrivate();
        publicKey = keyPair.getPublic();

        Path privPath = Path.of(privateKeyFile);
        Path pubPath = Path.of(publicKeyFile);

        Files.createDirectories(privPath.getParent());

        String privPem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(privateKey.getEncoded())
                + "\n-----END PRIVATE KEY-----";

        String pubPem = "-----BEGIN PUBLIC KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(publicKey.getEncoded())
                + "\n-----END PUBLIC KEY-----";

        Files.writeString(privPath, privPem);
        Files.writeString(pubPath, pubPem);
    }

    private PrivateKey parsePrivateKey(String pem) throws Exception {
        String cleaned = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(cleaned);
        return KeyFactory.getInstance("RSA")
                .generatePrivate(new PKCS8EncodedKeySpec(decoded));
    }

    private PublicKey parsePublicKey(String pem) throws Exception {
        String cleaned = pem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(cleaned);
        return KeyFactory.getInstance("RSA")
                .generatePublic(new X509EncodedKeySpec(decoded));
    }

    public PrivateKey getPrivateKey() {
        return privateKey;
    }

    public PublicKey getPublicKey() {
        return publicKey;
    }
}
```

- [ ] **Step 2: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

---

### Task 2: Add JWKS Endpoint to UserService

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/JwksController.java`

- [ ] **Step 1: Create JwksController**

Exposes the RSA public key in standard JWKS format at `/.well-known/jwks.json`.

```java
package iuh.fit.UserService.Config;

import com.nimbusds.jose.jwk.RSAKey;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.interfaces.RSAPublicKey;
import java.util.Map;

@RestController
public class JwksController {

    private final RsaKeyManager rsaKeyManager;

    public JwksController(RsaKeyManager rsaKeyManager) {
        this.rsaKeyManager = rsaKeyManager;
    }

    @GetMapping("/.well-known/jwks.json")
    public Map<String, Object> getJwks() throws Exception {
        RSAPublicKey publicKey = (RSAPublicKey) rsaKeyManager.getPublicKey();

        RSAKey jwk = new RSAKey.Builder(publicKey)
                .keyID("d4c-key-1")
                .algorithm(com.nimbusds.jose.JWSAlgorithm.RS256)
                .use(com.nimbusds.jose.JWKUse.SIG)
                .build();

        return Map.of("keys", jwk.toJSONObject());
    }
}
```

- [ ] **Step 2: Add nimbus-jose-jwt dependency to pom.xml**

Add to `UserService/pom.xml` inside `<dependencies>`:

```xml
<!-- Nimbus JOSE JWT for JWKS serialization -->
<dependency>
    <groupId>com.nimbusds</groupId>
    <artifactId>nimbus-jose-jwt</artifactId>
    <version>9.37.3</version>
</dependency>
```

- [ ] **Step 3: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

---

### Task 3: Update JwtUtils to Use RSA Signing

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/JwtUtils.java`

- [ ] **Step 1: Replace entire JwtUtils.java with RSA version**

The new version uses RSA private key for signing, adds `email` claim, and removes HMAC-specific code.

```java
package iuh.fit.UserService.Config;

import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.PrivateKey;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtUtils {

    private final RsaKeyManager rsaKeyManager;
    private final long jwtExpirationMs;
    private final long jwtRefreshExpirationMs;

    public JwtUtils(RsaKeyManager rsaKeyManager,
                    @Value("${jwt.expirationMs}") long jwtExpirationMs,
                    @Value("${jwt.refreshExpirationMs}") long jwtRefreshExpirationMs) {
        this.rsaKeyManager = rsaKeyManager;
        this.jwtExpirationMs = jwtExpirationMs;
        this.jwtRefreshExpirationMs = jwtRefreshExpirationMs;
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(userDetails, null, null);
    }

    public String generateToken(UserDetails userDetails, Long userId) {
        return generateToken(userDetails, userId, null);
    }

    public String generateToken(UserDetails userDetails, Long userId, String email) {
        var builder = Jwts.builder()
                .subject(userDetails.getUsername())
                .claim("roles", extractRoles(userDetails))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(rsaKeyManager.getPrivateKey());

        if (userId != null) {
            builder.claim("userId", userId);
        }
        if (email != null) {
            builder.claim("email", email);
        }

        return builder.compact();
    }

    public String generateRefreshToken(UserDetails userDetails) {
        return generateRefreshToken(userDetails, null, null);
    }

    public String generateRefreshToken(UserDetails userDetails, Long userId) {
        return generateRefreshToken(userDetails, userId, null);
    }

    public String generateRefreshToken(UserDetails userDetails, Long userId, String email) {
        var builder = Jwts.builder()
                .subject(userDetails.getUsername())
                .claim("roles", extractRoles(userDetails))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtRefreshExpirationMs))
                .signWith(rsaKeyManager.getPrivateKey());

        if (userId != null) {
            builder.claim("userId", userId);
        }
        if (email != null) {
            builder.claim("email", email);
        }

        return builder.compact();
    }

    private List<String> extractRoles(UserDetails userDetails) {
        return userDetails.getAuthorities()
                .stream()
                .map(grantedAuthority -> grantedAuthority.getAuthority())
                .collect(Collectors.toList());
    }

    public long getRefreshTokenExpirationMs() {
        return jwtRefreshExpirationMs;
    }
}
```

- [ ] **Step 2: Update AuthServiceImpl to pass email to token generation**

Modify `UserService/src/main/java/iuh/fit/UserService/Service/impl/AuthServiceImpl.java`:

Change line 82 from:
```java
String jwt = jwtUtils.generateToken(userDetails, user.getId());
```
to:
```java
String jwt = jwtUtils.generateToken(userDetails, user.getId(), user.getEmail());
```

Change line 83 from:
```java
String refreshToken = jwtUtils.generateRefreshToken(userDetails, user.getId());
```
to:
```java
String refreshToken = jwtUtils.generateRefreshToken(userDetails, user.getId(), user.getEmail());
```

- [ ] **Step 3: Update AuthController refresh-token to pass email**

Modify `UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java`:

Change line 97 from:
```java
String newAccessToken = jwtUtils.generateToken(userDetails, user.getId());
```
to:
```java
String newAccessToken = jwtUtils.generateToken(userDetails, user.getId(), user.getEmail());
```

Change line 98 from:
```java
String newRefreshToken = jwtUtils.generateRefreshToken(userDetails, user.getId());
```
to:
```java
String newRefreshToken = jwtUtils.generateRefreshToken(userDetails, user.getId(), user.getEmail());
```

- [ ] **Step 4: Remove jwt.secret from application.properties**

Modify `UserService/src/main/resources/application.properties`:

Remove this line:
```
jwt.secret=${JWT_SECRET}
```

Keep these lines (unchanged):
```
jwt.expirationMs=86400000
jwt.refreshExpirationMs=604800000
```

- [ ] **Step 5: Update UserService .env**

Modify `UserService/.env`:

Remove:
```
JWT_SECRET=<redacted>
```

Add (optional — keys will be auto-generated if not set):
```
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
```

Modify `UserService/.env.example`:

Remove:
```
JWT_SECRET=
```

Add:
```
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
```

- [ ] **Step 6: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

---

### Task 4: Remove JwtAuthenticationFilter from UserService Security

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/SecurityConfig.java`

- [ ] **Step 1: Update SecurityConfig to remove JWT filter**

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

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final UserDetailsService userDetailsService;

    public SecurityConfig(UserDetailsService userDetailsService) {
        this.userDetailsService = userDetailsService;
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

Key changes:
- Removed `@Autowired private JwtAuthenticationFilter jwtAuthenticationFilter`
- Removed `http.addFilterBefore(jwtAuthenticationFilter, ...)`
- Added `/.well-known/jwks.json` to permitted paths

- [ ] **Step 2: Delete JwtAuthenticationFilter.java**

Delete: `UserService/src/main/java/iuh/fit/UserService/Config/JwtAuthenticationFilter.java`

- [ ] **Step 3: Verify compilation**

Run from `UserService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

---

### Task 5: Commit Phase 1

- [ ] **Step 1: Commit UserService changes**

```bash
git add UserService/
git commit -m "feat(UserService): RSA key pair, JWKS endpoint, remove JWT filter"
```

---

## Phase 2: Api-Gateway — JWT Validation + Header Injection

### Task 6: Add JWT Dependencies to Api-Gateway

**Files:**
- Modify: `Api-Gateway/build.gradle`

- [ ] **Step 1: Add dependencies to build.gradle**

Add to `dependencies` block in `Api-Gateway/build.gradle`:

```groovy
// JWT validation with RSA support
implementation 'io.jsonwebtoken:jjwt-api:0.12.3'
runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.3'
runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.3'
```

Note: `spring-boot-starter-webflux` is already transitively included by `spring-cloud-starter-gateway`.

- [ ] **Step 2: Verify compilation**

Run from `Api-Gateway/`:
```bash
./gradlew compileJava --quiet
```
Expected: BUILD SUCCESSFUL

---

### Task 7: Add JWKS Cache to Api-Gateway

**Files:**
- Create: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/JwksCache.java`

- [ ] **Step 1: Create JwksCache**

This component fetches the JWKS from UserService on startup, caches the public key, and supports re-fetch on validation failure (for key rotation).

```java
package iuh.fit.apigateway.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class JwksCache {

    private static final Logger log = LoggerFactory.getLogger(JwksCache.class);

    private final WebClient webClient;
    private final String jwksUrl;
    private final AtomicReference<PublicKey> publicKeyRef = new AtomicReference<>();

    public JwksCache(
            @Value("${gateway.jwks.url:http://userservice:8081/.well-known/jwks.json}") String jwksUrl) {
        this.jwksUrl = jwksUrl;
        this.webClient = WebClient.builder().build();
    }

    public void fetchAndCache() {
        try {
            Map<String, Object> jwks = webClient.get()
                    .uri(jwksUrl)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (jwks == null || !jwks.containsKey("keys")) {
                throw new IllegalStateException("Invalid JWKS response: missing 'keys'");
            }

            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> keys = (java.util.List<Map<String, Object>>) jwks.get("keys");
            if (keys.isEmpty()) {
                throw new IllegalStateException("JWKS response has no keys");
            }

            Map<String, Object> key = keys.get(0);
            String n = (String) key.get("n");
            String e = (String) key.get("e");

            byte[] modulusBytes = Base64.getUrlDecoder().decode(n);
            byte[] exponentBytes = Base64.getUrlDecoder().decode(e);

            java.math.BigInteger modulus = new java.math.BigInteger(1, modulusBytes);
            java.math.BigInteger exponent = new java.math.BigInteger(1, exponentBytes);

            RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent);
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(spec);

            publicKeyRef.set(publicKey);
            log.info("JWKS public key loaded successfully from {}", jwksUrl);
        } catch (Exception ex) {
            log.error("Failed to fetch JWKS from {}: {}", jwksUrl, ex.getMessage());
            throw new IllegalStateException("Failed to initialize JWKS cache", ex);
        }
    }

    public PublicKey getPublicKey() {
        PublicKey key = publicKeyRef.get();
        if (key == null) {
            throw new IllegalStateException("JWKS public key not loaded");
        }
        return key;
    }

    public void refresh() {
        log.info("Refreshing JWKS public key...");
        fetchAndCache();
    }
}
```

- [ ] **Step 2: Add JWKS config to application.properties**

Add to `Api-Gateway/src/main/resources/application.properties`:

```properties
# JWKS Configuration
gateway.jwks.url=${JWKS_URL:http://userservice:8081/.well-known/jwks.json}
gateway.jwks.cache-ttl-ms=${JWKS_CACHE_TTL_MS:300000}
```

- [ ] **Step 3: Add JWKS env vars to Api-Gateway .env**

Add to `Api-Gateway/.env`:
```
JWKS_URL=http://userservice:8081/.well-known/jwks.json
JWKS_CACHE_TTL_MS=300000
```

Add to `Api-Gateway/.env.example`:
```
JWKS_URL=
JWKS_CACHE_TTL_MS=
```

- [ ] **Step 4: Verify compilation**

Run from `Api-Gateway/`:
```bash
./gradlew compileJava --quiet
```
Expected: BUILD SUCCESSFUL

---

### Task 8: Add JWT Validation Utility to Api-Gateway

**Files:**
- Create: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/JwtUtils.java`

- [ ] **Step 1: Create JwtUtils for Gateway**

Validates JWT tokens using the cached RSA public key and extracts claims.

```java
package iuh.fit.apigateway.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.SecurityException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.security.PublicKey;
import java.util.List;

@Component
public class JwtUtils {

    private static final Logger log = LoggerFactory.getLogger(JwtUtils.class);

    private final JwksCache jwksCache;

    public JwtUtils(JwksCache jwksCache) {
        this.jwksCache = jwksCache;
    }

    public Claims validateToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(jwksCache.getPublicKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            log.warn("JWT token is expired: {}", e.getMessage());
            throw new JwtValidationException("Token expired");
        } catch (MalformedJwtException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            throw new JwtValidationException("Invalid token");
        } catch (SecurityException e) {
            log.warn("JWT signature verification failed: {}", e.getMessage());
            throw new JwtValidationException("Invalid token signature");
        } catch (UnsupportedJwtException e) {
            log.warn("Unsupported JWT token: {}", e.getMessage());
            throw new JwtValidationException("Unsupported token");
        } catch (IllegalArgumentException e) {
            log.warn("JWT claims string is empty: {}", e.getMessage());
            throw new JwtValidationException("Invalid token");
        }
    }

    public String getUsername(Claims claims) {
        return claims.getSubject();
    }

    public Long getUserId(Claims claims) {
        Object userId = claims.get("userId");
        if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        }
        return userId != null ? Long.valueOf(userId.toString()) : null;
    }

    public String getEmail(Claims claims) {
        return claims.get("email", String.class);
    }

    @SuppressWarnings("unchecked")
    public List<String> getRoles(Claims claims) {
        return claims.get("roles", List.class);
    }

    public static class JwtValidationException extends RuntimeException {
        public JwtValidationException(String message) {
            super(message);
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

Run from `Api-Gateway/`:
```bash
./gradlew compileJava --quiet
```
Expected: BUILD SUCCESSFUL

---

### Task 9: Add Route Protection Config to Api-Gateway

**Files:**
- Create: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RouteProtectionConfig.java`

- [ ] **Step 1: Create RouteProtectionConfig**

Defines which route patterns require authentication and which are public.

```java
package iuh.fit.apigateway.config;

import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class RouteProtectionConfig {

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/",
            "/api/products/",
            "/api/categories/",
            "/api/webhooks/",
            "/v3/api-docs/",
            "/swagger-ui/",
            "/actuator/"
    );

    public boolean requiresAuth(String path) {
        if (path == null) return false;
        return PUBLIC_PATHS.stream().noneMatch(path::startsWith);
    }
}
```

- [ ] **Step 2: Verify compilation**

Run from `Api-Gateway/`:
```bash
./gradlew compileJava --quiet
```
Expected: BUILD SUCCESSFUL

---

### Task 10: Add JWT Validation GlobalFilter to Api-Gateway

**Files:**
- Create: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/JwtValidationFilter.java`

- [ ] **Step 1: Create JwtValidationFilter**

This is the core GlobalFilter that validates JWTs on protected routes and injects user identity headers.

```java
package iuh.fit.apigateway.config;

import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class JwtValidationFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtValidationFilter.class);

    private final JwtUtils jwtUtils;
    private final RouteProtectionConfig routeProtectionConfig;
    private final JwksCache jwksCache;

    public JwtValidationFilter(JwtUtils jwtUtils, RouteProtectionConfig routeProtectionConfig, JwksCache jwksCache) {
        this.jwtUtils = jwtUtils;
        this.routeProtectionConfig = routeProtectionConfig;
        this.jwksCache = jwksCache;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (!routeProtectionConfig.requiresAuth(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return unauthorized(exchange, "Missing authentication token");
        }

        String token = authHeader.substring(7);

        try {
            Claims claims = jwtUtils.validateToken(token);

            String userId = String.valueOf(jwtUtils.getUserId(claims));
            String username = jwtUtils.getUsername(claims);
            String email = jwtUtils.getEmail(claims);
            List<String> roles = jwtUtils.getRoles(claims);

            ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Username", username)
                    .header("X-User-Email", email != null ? email : "")
                    .header("X-User-Roles", String.join(",", roles != null ? roles : List.of()))
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (JwtUtils.JwtValidationException e) {
            return unauthorized(exchange, e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error during JWT validation: {}", e.getMessage());
            return unauthorized(exchange, "Authentication failed");
        }
    }

    @Override
    public int getOrder() {
        return -1;
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String body = "{\"error\":\"Unauthorized\",\"message\":\"" + message + "\"}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }
}
```

- [ ] **Step 2: Verify compilation**

Run from `Api-Gateway/`:
```bash
./gradlew compileJava --quiet
```
Expected: BUILD SUCCESSFUL

---

### Task 11: Add Admin Role Filter to Api-Gateway

**Files:**
- Create: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/AdminRoleFilter.java`

- [ ] **Step 1: Create AdminRoleFilter**

Checks `X-User-Roles` header for ADMIN role on `/api/admin/**` routes.

```java
package iuh.fit.apigateway.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

@Component
public class AdminRoleFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(AdminRoleFilter.class);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (!path.startsWith("/api/admin/")) {
            return chain.filter(exchange);
        }

        String rolesHeader = exchange.getRequest().getHeaders().getFirst("X-User-Roles");

        if (rolesHeader == null || !rolesHeader.contains("ADMIN")) {
            return forbidden(exchange, "Admin access required");
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return 0;
    }

    private Mono<Void> forbidden(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.FORBIDDEN);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String body = "{\"error\":\"Forbidden\",\"message\":\"" + message + "\"}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }
}
```

- [ ] **Step 2: Verify compilation**

Run from `Api-Gateway/`:
```bash
./gradlew compileJava --quiet
```
Expected: BUILD SUCCESSFUL

---

### Task 12: Initialize JWKS on Gateway Startup

**Files:**
- Modify: `Api-Gateway/src/main/java/iuh/fit/apigateway/ApiGatewayApplication.java`

- [ ] **Step 1: Update ApiGatewayApplication to fetch JWKS on startup**

Replace the entire file:

```java
package iuh.fit.apigateway;

import iuh.fit.apigateway.config.JwksCache;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }

    @Bean
    CommandLineRunner initJwks(JwksCache jwksCache) {
        return args -> jwksCache.fetchAndCache();
    }
}
```

- [ ] **Step 2: Verify compilation**

Run from `Api-Gateway/`:
```bash
./gradlew compileJava --quiet
```
Expected: BUILD SUCCESSFUL

---

### Task 13: Commit Phase 2

- [ ] **Step 1: Commit Api-Gateway changes**

```bash
git add Api-Gateway/
git commit -m "feat(Api-Gateway): JWT validation filter, JWKS cache, admin role filter"
```

---

## Phase 3: Downstream Services — Remove JWT Logic

### Task 14: Update CartService Security

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/security/SecurityConfig.java`
- Delete: `CartService/src/main/java/iuh/fit/CartService/security/JwtUtils.java`
- Delete: `CartService/src/main/java/iuh/fit/CartService/security/JwtAuthenticationFilter.java`

- [ ] **Step 1: Replace SecurityConfig.java**

```java
package iuh.fit.CartService.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/health").permitAll()
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}
```

- [ ] **Step 2: Delete JWT files**

Delete:
- `CartService/src/main/java/iuh/fit/CartService/security/JwtUtils.java`
- `CartService/src/main/java/iuh/fit/CartService/security/JwtAuthenticationFilter.java`

- [ ] **Step 3: Remove spring-security and jjwt dependencies from pom.xml**

In `CartService/pom.xml`, remove:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

And remove all `jjwt-*` dependencies.

Also remove `JWT_SECRET` from `CartService/src/main/resources/application.properties` and `CartService/.env`.

- [ ] **Step 4: Verify compilation**

Run from `CartService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

---

### Task 15: Update OrderService Security

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/security/SecurityConfig.java`
- Delete: `OrderService/src/main/java/com/iuh/fit/security/JwtUtils.java`
- Delete: `OrderService/src/main/java/com/iuh/fit/security/JwtAuthenticationFilter.java`

- [ ] **Step 1: Replace SecurityConfig.java**

```java
package com.iuh.fit.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/health", "/api/public/**").permitAll()
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}
```

- [ ] **Step 2: Delete JWT files**

Delete:
- `OrderService/src/main/java/com/iuh/fit/security/JwtUtils.java`
- `OrderService/src/main/java/com/iuh/fit/security/JwtAuthenticationFilter.java`

- [ ] **Step 3: Remove spring-security and jjwt dependencies from pom.xml**

In `OrderService/pom.xml`, remove `spring-boot-starter-security` and all `jjwt-*` dependencies.

Remove `JWT_SECRET` from `OrderService/src/main/resources/application.properties` and `OrderService/.env`.

- [ ] **Step 4: Verify compilation**

Run from `OrderService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

---

### Task 16: Update PaymentService Security

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/security/SecurityConfig.java`
- Delete: `PaymentService/src/main/java/iuh/fit/PaymentService/security/JwtUtils.java`
- Delete: `PaymentService/src/main/java/iuh/fit/PaymentService/security/JwtAuthenticationFilter.java`

- [ ] **Step 1: Replace SecurityConfig.java**

```java
package iuh.fit.PaymentService.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/webhooks/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/**").permitAll()
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}
```

- [ ] **Step 2: Delete JWT files**

Delete:
- `PaymentService/src/main/java/iuh/fit/PaymentService/security/JwtUtils.java`
- `PaymentService/src/main/java/iuh/fit/PaymentService/security/JwtAuthenticationFilter.java`

- [ ] **Step 3: Remove spring-security and jjwt dependencies from pom.xml**

In `PaymentService/pom.xml`, remove `spring-boot-starter-security` and all `jjwt-*` dependencies.

Remove `JWT_SECRET` from `PaymentService/src/main/resources/application.properties` and `PaymentService/.env`.

- [ ] **Step 4: Verify compilation**

Run from `PaymentService/`:
```bash
./mvnw compile -q
```
Expected: BUILD SUCCESS

---

### Task 17: Commit Phase 3

- [ ] **Step 1: Commit downstream service changes**

```bash
git add CartService/ OrderService/ PaymentService/
git commit -m "refactor(services): remove JWT auth, trust Gateway headers"
```

---

## Phase 4: End-to-End Testing & Final Steps

### Task 18: Verify Full Build

- [ ] **Step 1: Build all services**

Run from project root:
```bash
# UserService
cd UserService && ./mvnw clean compile -q && cd ..

# Api-Gateway
cd Api-Gateway && ./gradlew clean build -x test --quiet && cd ..

# CartService
cd CartService && ./mvnw clean compile -q && cd ..

# OrderService
cd OrderService && ./mvnw clean compile -q && cd ..

# PaymentService
cd PaymentService && ./mvnw clean compile -q && cd ..
```

Expected: All builds succeed

---

### Task 19: Docker Compose Integration Test

- [ ] **Step 1: Start the full stack**

From project root:
```bash
docker compose up --build -d
```

Wait for all services to be healthy:
```bash
docker compose ps
```

- [ ] **Step 2: Test public routes (should work without auth)**

```bash
# Products should be accessible
curl http://localhost:8080/api/products

# Categories should be accessible
curl http://localhost:8080/api/categories

# Auth endpoints should work
curl -X POST http://localhost:8080/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<admin-password>"}'
```

- [ ] **Step 3: Test protected routes without token (should return 401)**

```bash
curl -v http://localhost:8080/api/users/me
```
Expected: `HTTP/1.1 401 Unauthorized` with `{"error":"Unauthorized","message":"Missing authentication token"}`

- [ ] **Step 4: Test protected routes with valid token (should work)**

After signing in and getting a JWT:
```bash
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer <jwt-token>"
```
Expected: User profile data returned

- [ ] **Step 5: Test admin routes with non-admin token (should return 403)**

```bash
curl http://localhost:8080/api/admin/users \
  -H "Authorization: Bearer <non-admin-jwt>"
```
Expected: `HTTP/1.1 403 Forbidden` with `{"error":"Forbidden","message":"Admin access required"}`

- [ ] **Step 6: Test admin routes with admin token (should work)**

```bash
curl http://localhost:8080/api/admin/users \
  -H "Authorization: Bearer <admin-jwt>"
```
Expected: User list returned

---

### Task 20: Final Commit

- [ ] **Step 1: Commit all remaining changes**

```bash
git add .
git commit -m "feat: centralized auth at API Gateway with RSA keys and header injection"
```

---

## Testing Strategy

**Manual testing is the primary verification method** since no automated test infrastructure exists for frontend or ProductService.

Test matrix:
1. **UserService startup**: RSA keys generated on first run, loaded on restart
2. **JWKS endpoint**: `curl http://localhost:8081/.well-known/jwks.json` returns valid JWKS
3. **Gateway startup**: Fetches JWKS successfully, logs confirmation
4. **Login flow**: Sign in returns JWT with email claim
5. **Protected route + no token**: 401 from Gateway
6. **Protected route + valid token**: Request forwarded with X-User-* headers
7. **Admin route + non-admin**: 403 from Gateway
8. **Admin route + admin**: Request forwarded
9. **Public route**: No validation, passes through
10. **Refresh token**: Still works via UserService directly
11. **Service restart**: Existing JWTs still valid (same RSA keys)
