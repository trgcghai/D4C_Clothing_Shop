package iuh.fit.UserService.Config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.util.ContentCachingRequestWrapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RateLimitInterceptorTest {

    private RedisTemplate<String, String> redisTemplate;
    private ZSetOperations<String, String> zSetOps;
    private RateLimitInterceptor interceptor;

    @BeforeEach
    void setUp() {
        redisTemplate = mock(RedisTemplate.class);
        zSetOps = mock(ZSetOperations.class);
        when(redisTemplate.opsForZSet()).thenReturn(zSetOps);
        lenient().when(zSetOps.add(anyString(), anyString(), anyDouble())).thenReturn(true);
        lenient().when(zSetOps.removeRangeByScore(anyString(), anyDouble(), anyDouble())).thenReturn(0L);
        lenient().when(redisTemplate.expire(anyString(), anyLong(), any())).thenReturn(true);
        interceptor = new RateLimitInterceptor(redisTemplate, new ObjectMapper());
    }

    private MockHttpServletRequest createPostRequest(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("POST");
        request.setRequestURI(uri);
        request.setRemoteAddr("192.168.1.100");
        return request;
    }

    private ContentCachingRequestWrapper createSignupRequest(String email) throws Exception {
        MockHttpServletRequest mock = createPostRequest("/api/auth/signup");
        mock.setCharacterEncoding("UTF-8");
        mock.setContent(("{" +
                "\"username\":\"testuser\"," +
                "\"email\":\"" + email + "\"," +
                "\"password\":\"Test123!\"," +
                "\"fullName\":\"Test User\"," +
                "\"phoneNumber\":\"0123456789\"" +
                "}").getBytes());
        ContentCachingRequestWrapper wrapper = new ContentCachingRequestWrapper(mock);
        wrapper.getInputStream().readAllBytes();
        return wrapper;
    }

    @Test
    void signin_Allowed_WhenUnderLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(3L);

        MockHttpServletRequest request = createPostRequest("/api/auth/signin");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        assertEquals(200, response.getStatus());
        verify(zSetOps).count(eq("ratelimit:userservice:signin:192.168.1.100"), anyDouble(), anyDouble());
    }

    @Test
    void signin_Blocked_WhenOverLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(6L);

        MockHttpServletRequest request = createPostRequest("/api/auth/signin");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertFalse(result);
        assertEquals(429, response.getStatus());
        assertEquals("30", response.getHeader("Retry-After"));
        assertTrue(response.getContentAsString().contains("Too many login attempts"));
        verify(zSetOps).count(eq("ratelimit:userservice:signin:192.168.1.100"), anyDouble(), anyDouble());
    }

    @Test
    void signin_Allowed_AtExactLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(5L);

        MockHttpServletRequest request = createPostRequest("/api/auth/signin");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
    }

    @Test
    void signupIp_Allowed_WhenUnderLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(2L);

        ContentCachingRequestWrapper request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        assertEquals(200, response.getStatus());
        verify(zSetOps).count(eq("ratelimit:userservice:signup:ip:192.168.1.100"), anyDouble(), anyDouble());
    }

    @Test
    void signupIp_Blocked_WhenOverLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(4L);

        ContentCachingRequestWrapper request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertFalse(result);
        assertEquals(429, response.getStatus());
        assertTrue(response.getContentAsString().contains("Too many signup attempts"));
        assertEquals("30", response.getHeader("Retry-After"));
        verify(zSetOps).count(eq("ratelimit:userservice:signup:ip:192.168.1.100"), anyDouble(), anyDouble());
    }

    @Test
    void signupEmail_Blocked_WhenOverLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble()))
                .thenReturn(1L)
                .thenReturn(3L);

        ContentCachingRequestWrapper request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertFalse(result);
        assertEquals(429, response.getStatus());
        verify(zSetOps, times(2)).count(anyString(), anyDouble(), anyDouble());
        verify(zSetOps).count(eq("ratelimit:userservice:signup:ip:192.168.1.100"), anyDouble(), anyDouble());
        verify(zSetOps).count(eq("ratelimit:userservice:signup:email:test@example.com"), anyDouble(), anyDouble());
    }

    @Test
    void signupEmail_Allowed_WhenUnderLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble()))
                .thenReturn(1L)
                .thenReturn(1L);

        ContentCachingRequestWrapper request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
    }

    @Test
    void signupEmail_LowercasesEmailForKey() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(1L);

        ContentCachingRequestWrapper request = createSignupRequest("Test@Example.COM");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        verify(zSetOps).count(eq("ratelimit:userservice:signup:email:test@example.com"), anyDouble(), anyDouble());
    }

    @Test
    void signup_SkipsEmailCheck_WhenBodyEmpty() throws Exception {
        MockHttpServletRequest request = createPostRequest("/api/auth/signup");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(2L);

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        verify(zSetOps, times(1)).count(anyString(), anyDouble(), anyDouble());
    }

    @Test
    void signup_SkipsEmailCheck_WhenParseFails() throws Exception {
        MockHttpServletRequest request = createPostRequest("/api/auth/signup");
        request.setContent("not-json".getBytes());
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(2L);

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        verify(zSetOps, times(1)).count(anyString(), anyDouble(), anyDouble());
    }

    @Test
    void signup_Allowed_WhenRedisFails() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble()))
                .thenThrow(new RuntimeException("Redis connection refused"));

        ContentCachingRequestWrapper request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        assertEquals(200, response.getStatus());
    }

    @Test
    void getRequests_NotRateLimited() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("GET");
        request.setRequestURI("/api/auth/signin");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        verify(zSetOps, never()).count(anyString(), anyDouble(), anyDouble());
    }
}
