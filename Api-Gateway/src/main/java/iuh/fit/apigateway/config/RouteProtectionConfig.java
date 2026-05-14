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
        return PUBLIC_PATHS.stream().noneMatch(p -> path.startsWith(p) || (path + "/").startsWith(p));
    }
}
