package iuh.fit.CartService.listener;

import iuh.fit.CartService.repository.CartItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductUpdateListenerTest {

    @Mock
    private CartItemRepository cartItemRepository;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @InjectMocks
    private ProductUpdateListener listener;

    private Map<String, Object> createEventMessage(String productId) {
        return Map.of(
            "eventId", "test-event-id",
            "eventType", "UPDATE",
            "timestamp", "2026-03-06T00:00:00Z",
            "data", Map.of(
                "id", productId,
                "name", "Test Product",
                "price", 100.0,
                "imageUrl", "http://example.com/img.jpg"
            )
        );
    }

    @Test
    void shouldMarkNeedsSyncAndEvictCache_WhenProductUpdated() {
        String productId = "prod-123";
        when(cartItemRepository.markNeedsSyncByProductId(productId)).thenReturn(5);
        when(cartItemRepository.findDistinctUserIdsByProductId(productId)).thenReturn(List.of(1L, 2L, 3L));
        when(redisTemplate.delete(anyList())).thenReturn(3L);

        listener.handleProductUpdate(createEventMessage(productId));

        verify(cartItemRepository).markNeedsSyncByProductId(productId);
        verify(cartItemRepository).findDistinctUserIdsByProductId(productId);
        verify(redisTemplate).delete(List.of("cart:1", "cart:2", "cart:3"));
    }

    @Test
    void shouldDoNothing_WhenNoCartItemsAffected() {
        String productId = "prod-999";
        when(cartItemRepository.markNeedsSyncByProductId(productId)).thenReturn(0);
        when(cartItemRepository.findDistinctUserIdsByProductId(productId)).thenReturn(List.of());

        listener.handleProductUpdate(createEventMessage(productId));

        verify(cartItemRepository).markNeedsSyncByProductId(productId);
        verify(cartItemRepository).findDistinctUserIdsByProductId(productId);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void shouldHandleNullDataGracefully() {
        Map<String, Object> message = Map.of("eventId", "test", "eventType", "UPDATE");

        listener.handleProductUpdate(message);

        verifyNoInteractions(cartItemRepository);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void shouldHandleExceptionGracefully() {
        String productId = "prod-123";
        when(cartItemRepository.markNeedsSyncByProductId(productId)).thenThrow(new RuntimeException("DB error"));

        try {
            listener.handleProductUpdate(createEventMessage(productId));
        } catch (RuntimeException e) {
            // Expected - exception is re-ththrown
        }

        verify(cartItemRepository).markNeedsSyncByProductId(productId);
    }
}
