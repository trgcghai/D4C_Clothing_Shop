package iuh.fit.UserService.Config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

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
        interceptor = new RateLimitInterceptor(redisTemplate, new ObjectMapper());
    }

    private MockHttpServletRequest createPostRequest(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("POST");
        request.setRequestURI(uri);
        request.setRemoteAddr("192.168.1.100");
        return request;
    }

    private MockHttpServletRequest createSignupRequest(String email) {
        MockHttpServletRequest request = createPostRequest("/api/auth/signup");
        request.setCharacterEncoding("UTF-8");
        request.setContent(("{" +
                "\"username\":\"testuser\"," +
                "\"email\":\"" + email + "\"," +
                "\"password\":\"Test123!\"," +
                "\"fullName\":\"Test User\"," +
                "\"phoneNumber\":\"0123456789\"" +
                "}").getBytes());
        return request;
    }

    @Test
    void signin_Allowed_WhenUnderLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(3L);

        MockHttpServletRequest request = createPostRequest("/api/auth/signin");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        assertEquals(200, response.getStatus());
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
    }

    @Test
    void signupIp_Allowed_WhenUnderLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(2L);

        MockHttpServletRequest request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
        assertEquals(200, response.getStatus());
    }

    @Test
    void signupIp_Blocked_WhenOverLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(4L);

        MockHttpServletRequest request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertFalse(result);
        assertEquals(429, response.getStatus());
        assertTrue(response.getContentAsString().contains("Too many signup attempts"));
    }

    @Test
    void signupEmail_Blocked_WhenOverLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble()))
                .thenReturn(1L)
                .thenReturn(3L);

        MockHttpServletRequest request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertFalse(result);
        assertEquals(429, response.getStatus());
    }

    @Test
    void signupEmail_Allowed_WhenUnderLimit() throws Exception {
        when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(1L);

        MockHttpServletRequest request = createSignupRequest("test@example.com");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean result = interceptor.preHandle(request, response, null);

        assertTrue(result);
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

        MockHttpServletRequest request = createSignupRequest("test@example.com");
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
