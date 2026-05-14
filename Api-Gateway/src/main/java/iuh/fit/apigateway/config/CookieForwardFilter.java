package iuh.fit.apigateway.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.stream.Collectors;

@Component
public class CookieForwardFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(CookieForwardFilter.class);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        var cookies = exchange.getRequest().getCookies();

        log.info("[CookieForwardFilter] path={}, cookieCount={}, cookieNames={}",
                path, cookies.size(), cookies.keySet());

        if (!cookies.isEmpty()) {
            String cookieHeader = cookies.keySet().stream()
                    .map(name -> cookies.get(name).stream()
                            .map(cookie -> name + "=" + cookie.getValue())
                            .collect(Collectors.joining("; ")))
                    .collect(Collectors.joining("; "));

            log.info("[CookieForwardFilter] Reconstructed Cookie header: {}", cookieHeader);

            ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header(HttpHeaders.COOKIE, cookieHeader)
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());
        }

        log.info("[CookieForwardFilter] No cookies found, passing through unchanged");
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -2;
    }
}
