package iuh.fit.UserService.Config;

import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

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

    public Long getUserIdFromToken(String token) {
        Object userId = Jwts.parser()
                .verifyWith(rsaKeyManager.getPublicKey())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("userId");
        if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        }
        return userId != null ? Long.valueOf(userId.toString()) : null;
    }

    public String getUserNameFromJwtToken(String token) {
        return Jwts.parser()
                .verifyWith(rsaKeyManager.getPublicKey())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public boolean validateJwtToken(String authToken) {
        try {
            Jwts.parser().verifyWith(rsaKeyManager.getPublicKey()).build().parseSignedClaims(authToken);
            return true;
        } catch (io.jsonwebtoken.MalformedJwtException e) {
            System.err.println("Invalid JWT token: " + e.getMessage());
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            System.err.println("JWT token is expired: " + e.getMessage());
        } catch (io.jsonwebtoken.UnsupportedJwtException e) {
            System.err.println("JWT token is unsupported: " + e.getMessage());
        } catch (IllegalArgumentException e) {
            System.err.println("JWT claims string is empty: " + e.getMessage());
        }
        return false;
    }

    public long getRefreshTokenExpirationMs() {
        return jwtRefreshExpirationMs;
    }
}
