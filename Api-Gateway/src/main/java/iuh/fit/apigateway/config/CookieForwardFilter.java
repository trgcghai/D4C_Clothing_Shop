package iuh.fit.apigateway.config;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.stream.Collectors;

/**
 * Reconstructs the Cookie header from parsed cookies before forwarding to downstream services.
 *
 * Spring Cloud Gateway (WebFlux/Netty) parses the Cookie header into a MultiValueMap
 * and removes the raw header. Downstream servlet-based services (e.g., UserService)
 * expect the raw Cookie header to read cookies via HttpServletRequest.getCookies().
 *
 * This filter bridges the gap by re-serializing parsed cookies back into the standard
 * "Cookie: name1=value1; name2=value2" header format.
 */
@Component
public class CookieForwardFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        var cookies = exchange.getRequest().getCookies();

        if (!cookies.isEmpty()) {
            String cookieHeader = cookies.keySet().stream()
                    .map(name -> cookies.get(name).stream()
                            .map(cookie -> name + "=" + cookie.getValue())
                            .collect(Collectors.joining("; ")))
                    .collect(Collectors.joining("; "));

            ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header(HttpHeaders.COOKIE, cookieHeader)
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -2;
    }
}
