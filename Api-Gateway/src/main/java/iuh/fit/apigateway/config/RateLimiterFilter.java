package iuh.fit.apigateway.config;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.time.Duration;

@Component
public class RateLimiterFilter implements GlobalFilter, Ordered {

    private final ReactiveRedisTemplate<String, String> redisTemplate;
    private static final String KEY_PREFIX = "ratelimit:gateway:global:";
    private static final int LIMIT = 100;
    private static final long WINDOW_MS = 60000;

    public RateLimiterFilter(ReactiveRedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        if (remoteAddress == null) {
            return chain.filter(exchange);
        }

        String ip = remoteAddress.getAddress().getHostAddress();
        String key = KEY_PREFIX + ip;
        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW_MS;

        return redisTemplate.opsForZSet().add(key, String.valueOf(now), (double) now)
                .then(redisTemplate.opsForZSet().removeRangeByScore(key, Range.closed(0.0, (double) windowStart)))
                .then(redisTemplate.opsForZSet().count(key, Range.closed((double) windowStart, (double) now)))
                .flatMap(count -> {
                    if (count != null && count > LIMIT) {
                        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                        exchange.getResponse().getHeaders().add("Retry-After", "30");
                        exchange.getResponse().getHeaders().add("X-RateLimit-Limit", String.valueOf(LIMIT));
                        exchange.getResponse().getHeaders().add("X-RateLimit-Remaining", "0");
                        return exchange.getResponse().setComplete();
                    }
                    return chain.filter(exchange);
                })
                .doOnSuccess(v -> redisTemplate.expire(key, Duration.ofSeconds(60)).subscribe());
    }

    @Override
    public int getOrder() {
        return -2;
    }
}
