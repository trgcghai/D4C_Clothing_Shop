package com.iuh.fit.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Component
public class JwtUtils {
    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey signingKey;

    @PostConstruct
    private void initSigningKey() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET is required and must be at least 32 bytes.");
        }

        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes (256 bits). Current: " + keyBytes.length + " bytes.");
        }

        signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String getUserNameFromJwtToken(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public Long getUserIdFromToken(String token) {
        Object userId = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("userId");
        if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        }
        return userId != null ? Long.valueOf(userId.toString()) : null;
    }

    @SuppressWarnings("unchecked")
    public String[] getRolesFromToken(String token) {
        var claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Object rolesObj = claims.get("roles");
        if (rolesObj == null) {
            rolesObj = claims.get("role");
        }

        if (rolesObj == null) return new String[0];

        if (rolesObj instanceof String) {
            String s = (String) rolesObj;
            if (s.contains(",")) return s.split(",");
            return new String[]{s};
        }

        if (rolesObj instanceof java.util.List) {
            java.util.List<?> list = (java.util.List<?>) rolesObj;
            return list.stream().map(Object::toString).toArray(String[]::new);
        }

        return new String[0];
    }

    public boolean validateJwtToken(String token) {
        try {
            Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
}
