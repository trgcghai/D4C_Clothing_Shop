package iuh.fit.UserService.Config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RateLimitInterceptor.class);
    private final RedisTemplate<String, String> redisTemplate;
    private static final String SIGNIN_KEY_PREFIX = "ratelimit:userservice:signin:";
    private static final int SIGNIN_LIMIT = 5;
    private static final String SIGNUP_IP_KEY_PREFIX = "ratelimit:userservice:signup:ip:";
    private static final String SIGNUP_EMAIL_KEY_PREFIX = "ratelimit:userservice:signup:email:";
    private static final int SIGNUP_IP_LIMIT = 3;
    private static final int SIGNUP_EMAIL_LIMIT = 2;
    private static final long WINDOW_MS = 60000;

    public RateLimitInterceptor(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String uri = request.getRequestURI();

        if (uri.equals("/api/auth/signin")) {
            String ip = request.getRemoteAddr();
            String key = SIGNIN_KEY_PREFIX + ip;
            return checkRateLimit(key, SIGNIN_LIMIT, "Too many login attempts. Please try again later.", response);
        }

        if (uri.equals("/api/auth/signup")) {
            String ip = request.getRemoteAddr();
            String ipKey = SIGNUP_IP_KEY_PREFIX + ip;
            if (!checkRateLimit(ipKey, SIGNUP_IP_LIMIT, "Too many signup attempts. Please try again later.", response)) {
                return false;
            }

            String email = extractEmailFromBody(request);
            if (email != null && !email.isBlank()) {
                String emailKey = SIGNUP_EMAIL_KEY_PREFIX + email.toLowerCase();
                if (!checkRateLimit(emailKey, SIGNUP_EMAIL_LIMIT, "Too many signup attempts. Please try again later.", response)) {
                    return false;
                }
            }
            return true;
        }

        return true;
    }

    private String extractEmailFromBody(HttpServletRequest request) {
        try {
            request.getInputStream().mark(Integer.MAX_VALUE);
            String body = new String(request.getInputStream().readAllBytes());
            request.getInputStream().reset();

            int emailStart = body.indexOf("\"email\"");
            if (emailStart == -1) return null;

            int colonIndex = body.indexOf(':', emailStart);
            if (colonIndex == -1) return null;

            int quoteStart = body.indexOf('"', colonIndex + 1);
            if (quoteStart == -1) return null;

            int quoteEnd = body.indexOf('"', quoteStart + 1);
            if (quoteEnd == -1) return null;

            return body.substring(quoteStart + 1, quoteEnd);
        } catch (IOException e) {
            log.warn("[RateLimiter] Failed to parse email from request body: {}", e.getMessage());
            return null;
        }
    }

    private boolean checkRateLimit(String key, int limit, String errorMessage, HttpServletResponse response) {
        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW_MS;

        try {
            redisTemplate.opsForZSet().add(key, UUID.randomUUID().toString(), (double) now);
            redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
            Long count = redisTemplate.opsForZSet().count(key, windowStart, now);
            redisTemplate.expire(key, 60, TimeUnit.SECONDS);

            if (count != null && count > limit) {
                response.setStatus(429);
                response.setHeader("Retry-After", "30");
                response.setHeader("Content-Type", "application/json");
                response.getWriter().write("{\"error\":\"" + errorMessage + "\",\"retryAfter\":30}");
                return false;
            }
        } catch (IOException e) {
            log.error("[RateLimiter] Failed to write rate limit response: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            log.warn("[RateLimiter] Redis unavailable, allowing request through: {}", e.getMessage());
            return true;
        }

        return true;
    }
}
