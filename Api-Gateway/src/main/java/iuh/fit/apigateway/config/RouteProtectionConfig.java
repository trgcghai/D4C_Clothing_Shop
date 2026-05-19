package iuh.fit.apigateway.config;

import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class RouteProtectionConfig {

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/",
            "/api/webhooks/",
            "/api/search/",
            "/v3/api-docs/",
            "/swagger-ui/",
            "/actuator/");

    public AccessLevel getAccessLevel(String path, HttpMethod method) {
        if (path == null)
            return AccessLevel.PUBLIC;

        // Normalize: ensure trailing slash for prefix matching
        String normalized = path.endsWith("/") ? path : path + "/";

        // Explicitly public paths
        if (PUBLIC_PATHS.stream().anyMatch(normalized::startsWith)) {
            return AccessLevel.PUBLIC;
        }

        // Product routes: GET is public, POST / PUT / DELETE / PATCH require
        // authentication
        if (path.startsWith("/api/products")) {
            if (method == HttpMethod.GET) {
                return AccessLevel.PUBLIC;
            }
            return AccessLevel.AUTHENTICATED;
        }

        // Category routes: GET is public, POST / PUT / DELETE require authentication
        if (path.startsWith("/api/categories")) {
            if (method == HttpMethod.GET) {
                return AccessLevel.PUBLIC;
            }
            return AccessLevel.AUTHENTICATED;
        }

        // Admin routes always require admin role
        if (path.startsWith("/api/admin")) {
            return AccessLevel.ADMIN;
        }

        // Everything else requires authentication
        return AccessLevel.AUTHENTICATED;
    }

    public enum AccessLevel {
        PUBLIC,
        AUTHENTICATED,
        ADMIN
    }
}
