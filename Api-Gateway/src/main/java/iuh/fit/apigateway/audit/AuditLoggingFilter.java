package iuh.fit.apigateway.audit;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * GlobalFilter that records one AuditLog entry per incoming request.
 *
 * <p>Execution order: runs AFTER JwtValidationFilter (order -1) and AdminRoleFilter (order 0)
 * so that X-User-Id / X-User-Username headers are already populated when we read them.
 *
 * <p>The actual Elasticsearch save is fire-and-forget and subscribed on the boundedElastic
 * scheduler so it never blocks the event-loop thread.
 */
@Component
public class AuditLoggingFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(AuditLoggingFilter.class);

    /**
     * Sensitive headers that must NOT be forwarded or stored.
     * Authorization / Cookie values could contain access tokens or session ids.
     */
    private static final List<String> SENSITIVE_HEADERS =
            List.of("authorization", "cookie", "x-api-key", "set-cookie");

    private final AuditLogRepository repository;

    public AuditLoggingFilter(AuditLogRepository repository) {
        this.repository = repository;
    }

    // AuditLoggingFilter runs last among our custom filters
    @Override
    public int getOrder() {
        return 1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        Instant start   = Instant.now();
        String  traceId = UUID.randomUUID().toString();

        // Decorate the exchange so downstream filters can read the correlation id
        exchange.getAttributes().put("audit.traceId", traceId);

        return chain.filter(exchange)
                .doFinally(signalType -> {
                    long durationMs = Instant.now().toEpochMilli() - start.toEpochMilli();
                    saveAuditLog(exchange, start, durationMs, traceId);
                });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private void saveAuditLog(ServerWebExchange exchange,
                               Instant start,
                               long durationMs,
                               String traceId) {

        ServerHttpRequest request = exchange.getRequest();

        String userId   = safeHeader(request, "X-User-Id");
        String username = safeHeader(request, "X-User-Username");
        String method   = request.getMethod() != null ? request.getMethod().name() : "UNKNOWN";
        String path     = request.getURI().getPath();
        String clientIp = resolveClientIp(request);

        int statusCode = 0;
        if (exchange.getResponse().getStatusCode() != null) {
            statusCode = exchange.getResponse().getStatusCode().value();
        }

        // Derive the target service from the first path segment after /api/
        String targetService = resolveTargetService(path);

        AuditLog auditLog = AuditLog.builder()
                .id(traceId)
                .timestamp(start)
                .userId(userId)
                .username(username)
                .method(method)
                .path(path)
                .clientIp(clientIp)
                .statusCode(statusCode)
                .durationMs(durationMs)
                .targetService(targetService)
                .build();

        // Write structured JSON audit line to the application log (picked up by logback)
        log.info("AUDIT",
                StructuredArguments.kv("traceId",       traceId),
                StructuredArguments.kv("userId",        userId),
                StructuredArguments.kv("username",      username),
                StructuredArguments.kv("method",        method),
                StructuredArguments.kv("path",          path),
                StructuredArguments.kv("clientIp",      clientIp),
                StructuredArguments.kv("statusCode",    statusCode),
                StructuredArguments.kv("durationMs",    durationMs),
                StructuredArguments.kv("targetService", targetService));

        // Asynchronous, fire-and-forget save to Elasticsearch
        // subscribeOn(boundedElastic) keeps the reactive event-loop free
        repository.save(auditLog)
                .subscribeOn(Schedulers.boundedElastic())
                .subscribe(
                        saved -> log.debug("Audit log persisted: id={}", saved.getId()),
                        err   -> log.warn("Failed to persist audit log for path={}: {}",
                                           path, err.getMessage())
                );
    }

    /** Returns the header value or null; never logs sensitive headers. */
    private String safeHeader(ServerHttpRequest request, String headerName) {
        if (SENSITIVE_HEADERS.contains(headerName.toLowerCase())) {
            return null;
        }
        return request.getHeaders().getFirst(headerName);
    }

    /** Prefer X-Forwarded-For (set by a load balancer) over the raw remote address. */
    private String resolveClientIp(ServerHttpRequest request) {
        String forwarded = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // X-Forwarded-For can be a comma-separated list; take the first (original client)
            return forwarded.split(",")[0].trim();
        }
        InetSocketAddress remote = request.getRemoteAddress();
        return remote != null ? remote.getAddress().getHostAddress() : "unknown";
    }

    /**
     * Extracts a logical service name from the request path.
     * Examples:
     *   /api/users/1     → USERSERVICE
     *   /api/products/3  → PRODUCTSERVICE
     *   /api/cart        → CARTSERVICE
     */
    private String resolveTargetService(String path) {
        if (path == null || !path.startsWith("/api/")) return "UNKNOWN";
        String[] parts = path.split("/");
        // parts[0]="", parts[1]="api", parts[2]=segment
        if (parts.length < 3) return "UNKNOWN";
        return switch (parts[2]) {
            case "users", "auth", "admin"   -> "USERSERVICE";
            case "products", "categories"   -> "PRODUCTSERVICE";
            case "cart"                     -> "CARTSERVICE";
            case "orders"                   -> "ORDERSERVICE";
            case "payments", "webhooks"     -> "PAYMENTSERVICE";
            case "recommendations"          -> "RECOMMENDATIONSERVICE";
            case "v1"                       -> "AISERVICE";
            default                        -> parts[2].toUpperCase();
        };
    }
}
