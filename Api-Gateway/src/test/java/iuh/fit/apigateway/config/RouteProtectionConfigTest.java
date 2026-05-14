package iuh.fit.apigateway.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RouteProtectionConfigTest {

    private final RouteProtectionConfig config = new RouteProtectionConfig();

    @Test
    void authRoutes_requireAuth() {
        assertTrue(config.requiresAuth("/api/users/me"));
        assertTrue(config.requiresAuth("/api/cart/items"));
        assertTrue(config.requiresAuth("/api/orders"));
        assertTrue(config.requiresAuth("/api/payments/create"));
    }

    @Test
    void publicRoutes_doNotRequireAuth() {
        assertFalse(config.requiresAuth("/api/auth/signin"));
        assertFalse(config.requiresAuth("/api/auth/signup"));
        assertFalse(config.requiresAuth("/api/auth/refresh-token"));
        assertFalse(config.requiresAuth("/api/products"));
        assertFalse(config.requiresAuth("/api/categories"));
        assertFalse(config.requiresAuth("/api/webhooks/sepay"));
        assertFalse(config.requiresAuth("/v3/api-docs"));
        assertFalse(config.requiresAuth("/swagger-ui/index.html"));
        assertFalse(config.requiresAuth("/actuator/health"));
    }

    @Test
    void adminRoutes_requireAuth() {
        assertTrue(config.requiresAuth("/api/admin/users"));
        assertTrue(config.requiresAuth("/api/admin/users/1/toggle-status"));
    }

    @Test
    void nullPath_doesNotRequireAuth() {
        assertFalse(config.requiresAuth(null));
    }
}
