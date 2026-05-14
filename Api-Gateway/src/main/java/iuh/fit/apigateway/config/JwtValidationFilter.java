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

    public JwtValidationFilter(JwtUtils jwtUtils, RouteProtectionConfig routeProtectionConfig) {
        this.jwtUtils = jwtUtils;
        this.routeProtectionConfig = routeProtectionConfig;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        RouteProtectionConfig.AccessLevel accessLevel = routeProtectionConfig.getAccessLevel(
                path, exchange.getRequest().getMethod());

        if (accessLevel == RouteProtectionConfig.AccessLevel.PUBLIC) {
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
