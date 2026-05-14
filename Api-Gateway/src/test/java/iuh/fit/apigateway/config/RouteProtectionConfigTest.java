package iuh.fit.apigateway.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import static org.junit.jupiter.api.Assertions.*;

class RouteProtectionConfigTest {

    private final RouteProtectionConfig config = new RouteProtectionConfig();

    @Test
    void publicRoutes_arePublic() {
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/api/auth/signin", HttpMethod.POST));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/api/auth/signup", HttpMethod.POST));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/api/auth/refresh-token", HttpMethod.POST));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/api/products", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/api/products/featured", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/api/categories", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/api/webhooks/sepay", HttpMethod.POST));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/v3/api-docs", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel("/actuator/health", HttpMethod.GET));
    }

    @Test
    void productMutations_requireAdmin() {
        assertEquals(RouteProtectionConfig.AccessLevel.ADMIN,
                config.getAccessLevel("/api/products", HttpMethod.POST));
        assertEquals(RouteProtectionConfig.AccessLevel.ADMIN,
                config.getAccessLevel("/api/products/123", HttpMethod.PUT));
        assertEquals(RouteProtectionConfig.AccessLevel.ADMIN,
                config.getAccessLevel("/api/products/123", HttpMethod.DELETE));
        assertEquals(RouteProtectionConfig.AccessLevel.ADMIN,
                config.getAccessLevel("/api/products/123", HttpMethod.PATCH));
    }

    @Test
    void userRoutes_requireAuth() {
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/users/me", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/users/me", HttpMethod.PUT));
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/users/me/change-password", HttpMethod.PUT));
    }

    @Test
    void cartRoutes_requireAuth() {
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/cart/items", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/cart/items", HttpMethod.POST));
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/cart/items/1", HttpMethod.DELETE));
    }

    @Test
    void orderRoutes_requireAuth() {
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/orders", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/orders", HttpMethod.POST));
    }

    @Test
    void paymentRoutes_requireAuth() {
        assertEquals(RouteProtectionConfig.AccessLevel.AUTHENTICATED,
                config.getAccessLevel("/api/payments/create", HttpMethod.POST));
    }

    @Test
    void adminRoutes_requireAdmin() {
        assertEquals(RouteProtectionConfig.AccessLevel.ADMIN,
                config.getAccessLevel("/api/admin/users", HttpMethod.GET));
        assertEquals(RouteProtectionConfig.AccessLevel.ADMIN,
                config.getAccessLevel("/api/admin/users/1/toggle-status", HttpMethod.PUT));
    }

    @Test
    void nullPath_isPublic() {
        assertEquals(RouteProtectionConfig.AccessLevel.PUBLIC,
                config.getAccessLevel(null, HttpMethod.GET));
    }
}
