package iuh.fit.UserService.Config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilsTest {

    private RsaKeyManager rsaKeyManager;
    private JwtUtils jwtUtils;

    @BeforeEach
    void setUp() throws Exception {
        rsaKeyManager = new RsaKeyManager();
        ReflectionTestUtils.setField(rsaKeyManager, "privateKeyFile", "config/test-rsa-private.pem");
        ReflectionTestUtils.setField(rsaKeyManager, "publicKeyFile", "config/test-rsa-public.pem");
        ReflectionTestUtils.setField(rsaKeyManager, "privateKeyEnv", "");
        ReflectionTestUtils.setField(rsaKeyManager, "publicKeyEnv", "");
        rsaKeyManager.init();

        jwtUtils = new JwtUtils(rsaKeyManager, 3600000L, 86400000L);
    }

    @Test
    void generateToken_containsEmailClaim() {
        UserDetails userDetails = createUserDetails();
        String token = jwtUtils.generateToken(userDetails, 1L, "test@example.com");

        Claims claims = decodeToken(token);

        assertEquals("test@example.com", claims.get("email", String.class));
    }

    @Test
    void generateToken_containsUserIdClaim() {
        UserDetails userDetails = createUserDetails();
        String token = jwtUtils.generateToken(userDetails, 42L, "test@example.com");

        Claims claims = decodeToken(token);

        assertEquals(42L, claims.get("userId", Long.class));
    }

    @Test
    void generateToken_containsRolesClaim() {
        UserDetails userDetails = createUserDetails();
        String token = jwtUtils.generateToken(userDetails, 1L, "test@example.com");

        Claims claims = decodeToken(token);

        List<?> roles = claims.get("roles", List.class);
        assertTrue(roles.contains("ROLE_USER"));
        assertTrue(roles.contains("ROLE_ADMIN"));
    }

    @Test
    void generateToken_containsUsernameAsSubject() {
        UserDetails userDetails = createUserDetails();
        String token = jwtUtils.generateToken(userDetails, 1L, "test@example.com");

        Claims claims = decodeToken(token);

        assertEquals("testuser", claims.getSubject());
    }

    @Test
    void generateToken_hasValidExpiration() {
        UserDetails userDetails = createUserDetails();
        String token = jwtUtils.generateToken(userDetails, 1L, "test@example.com");

        Claims claims = decodeToken(token);

        long exp = claims.getExpiration().getTime();
        long now = System.currentTimeMillis();
        long diff = exp - now;

        assertTrue(diff > 0, "Token should expire in the future");
        assertTrue(diff <= 3600000L + 5000, "Token expiration should be approximately jwtExpirationMs");
        assertTrue(diff >= 3600000L - 5000, "Token expiration should be approximately jwtExpirationMs");
    }

    @Test
    void generateRefreshToken_hasLongerExpiration() {
        UserDetails userDetails = createUserDetails();
        String refreshToken = jwtUtils.generateRefreshToken(userDetails, 1L, "test@example.com");

        Claims claims = decodeToken(refreshToken);

        long exp = claims.getExpiration().getTime();
        long now = System.currentTimeMillis();
        long diff = exp - now;

        assertTrue(diff > 3600000L, "Refresh token expiration should be longer than access token");
        assertTrue(diff <= 86400000L + 5000, "Refresh token expiration should be approximately jwtRefreshExpirationMs");
        assertTrue(diff >= 86400000L - 5000, "Refresh token expiration should be approximately jwtRefreshExpirationMs");
    }

    @Test
    void generateToken_withoutEmailAndUserId_stillWorks() {
        UserDetails userDetails = createUserDetails();
        String token = jwtUtils.generateToken(userDetails);

        Claims claims = decodeToken(token);

        assertEquals("testuser", claims.getSubject());
        assertNotNull(claims.get("roles"));
        assertNotNull(claims.getExpiration());
        assertNull(claims.get("userId"));
        assertNull(claims.get("email"));
    }

    private UserDetails createUserDetails() {
        return new User("testuser", "password",
                List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private Claims decodeToken(String token) {
        return Jwts.parser()
                .verifyWith(rsaKeyManager.getPublicKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
