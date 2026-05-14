package iuh.fit.CartService.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class GatewayIdentityFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(GatewayIdentityFilter.class);

    private static final String HEADER_USER_ID = "X-User-Id";

    private static final List<String> PUBLIC_PATHS = List.of(
            "/v3/api-docs/",
            "/swagger-ui/",
            "/swagger-ui.html",
            "/actuator/"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (PUBLIC_PATHS.stream().anyMatch(path::startsWith)) {
            filterChain.doFilter(request, response);
            return;
        }

        String userId = request.getHeader(HEADER_USER_ID);

        if (userId == null || userId.isBlank()) {
            log.warn("Request to {} missing X-User-Id header", path);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Missing authentication\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
