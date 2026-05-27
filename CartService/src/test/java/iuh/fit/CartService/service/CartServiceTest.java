package iuh.fit.CartService.service;

import iuh.fit.CartService.client.ProductServiceClient;
import iuh.fit.CartService.domain.dto.ProductDto;
import iuh.fit.CartService.exception.ServiceUnavailableException;
import iuh.fit.CartService.repository.CartItemRepository;
import iuh.fit.CartService.repository.CartRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock
    private CartRepository cartRepository;

    @Mock
    private CartItemRepository cartItemRepository;

    @Mock
    private ProductServiceClient productServiceClient;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private CartService cartService;

    @Test
    void getProductByIdFallback_whenCalled_throwsServiceUnavailable() {
        RuntimeException cause = new RuntimeException("Connection refused");

        ServiceUnavailableException exception = assertThrows(ServiceUnavailableException.class,
                () -> cartService.getProductByIdFallback("1", cause));

        assertEquals("Không thể kiểm tra sản phẩm, vui lòng thử lại sau", exception.getMessage());
    }

    @Test
    void getProductWithCircuitBreaker_whenProductServiceDown_throwsRuntimeException() {
        when(productServiceClient.getProductById(anyString()))
                .thenThrow(new RuntimeException("Connection refused"));

        assertThrows(RuntimeException.class,
                () -> cartService.getProductWithCircuitBreaker("1"));
    }
}
