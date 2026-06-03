package iuh.fit.CartService.service;

import iuh.fit.CartService.client.ProductServiceClient;
import iuh.fit.CartService.domain.dto.*;
import iuh.fit.CartService.domain.entity.Cart;
import iuh.fit.CartService.domain.entity.CartItem;
import iuh.fit.CartService.repository.CartItemRepository;
import iuh.fit.CartService.repository.CartRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceSyncTest {

    @Mock private CartRepository cartRepository;
    @Mock private CartItemRepository cartItemRepository;
    @Mock private ProductServiceClient productServiceClient;
    @Mock private RedisTemplate<String, String> redisTemplate;
    @Mock private ObjectMapper objectMapper;
    @InjectMocks private CartService cartService;

    private Cart testCart;
    private CartItem testItem;
    private ProductDto testProduct;
    private VariantDto testVariant;

    @BeforeEach
    void setUp() {
        testCart = Cart.builder().id(1L).userId(42L).build();
        testVariant = VariantDto.builder()
                .id("var-1").productId("prod-1").color("Red").size("M")
                .quantity(10).sku("SKU-001").build();
        testProduct = ProductDto.builder()
                .id("prod-1").name("Updated T-Shirt").price(new BigDecimal("150.00"))
                .imageUrl("http://new-image.jpg").status("ACTIVE")
                .variants(List.of(testVariant)).build();
        testItem = CartItem.builder()
                .id(100L).cart(testCart).variantId("var-1").productId("prod-1")
                .productName("Old T-Shirt").color("Red").size("M")
                .price(new BigDecimal("100.00")).quantity(2)
                .sku("SKU-001").imageUrl("http://old-image.jpg")
                .needsSync(true).build();
    }

    @Test
    void shouldSyncItemsWithBulkFetch() {
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of(testItem));
        when(productServiceClient.bulkGetProducts(any(BulkProductRequest.class)))
                .thenReturn(BulkProductResponse.builder().products(Map.of("prod-1", testProduct)).build());

        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());

        assertEquals(1, response.getSynced().size());
        assertEquals(0, response.getErrors().size());
        SyncResponse.SyncedItem synced = response.getSynced().get(0);
        assertEquals("var-1", synced.getVariantId());
        assertEquals("Updated T-Shirt", synced.getProductName());
        assertEquals(new BigDecimal("150.00"), synced.getPrice());
        assertFalse(synced.getNeedsSync());
        verify(cartItemRepository).save(testItem);
        verify(redisTemplate).delete("cart:42");
        assertEquals(new BigDecimal("150.00"), testItem.getPrice());
        assertFalse(testItem.getNeedsSync());
    }

    @Test
    void shouldReturnError_WhenVariantOutOfStock() {
        VariantDto oos = VariantDto.builder().id("var-1").productId("prod-1")
                .color("Red").size("M").quantity(0).sku("SKU-001").build();
        ProductDto p = ProductDto.builder().id("prod-1").name("T-Shirt")
                .price(new BigDecimal("150.00")).imageUrl("http://img.jpg")
                .status("ACTIVE").variants(List.of(oos)).build();
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of(testItem));
        when(productServiceClient.bulkGetProducts(any(BulkProductRequest.class)))
                .thenReturn(BulkProductResponse.builder().products(Map.of("prod-1", p)).build());

        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());

        assertEquals(0, response.getSynced().size());
        assertEquals(1, response.getErrors().size());
        assertEquals("OUT_OF_STOCK", response.getErrors().get(0).getReason());
    }

    @Test
    void shouldReturnError_WhenInsufficientStock() {
        VariantDto low = VariantDto.builder().id("var-1").productId("prod-1")
                .color("Red").size("M").quantity(1).sku("SKU-001").build();
        ProductDto p = ProductDto.builder().id("prod-1").name("T-Shirt")
                .price(new BigDecimal("150.00")).imageUrl("http://img.jpg")
                .status("ACTIVE").variants(List.of(low)).build();
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of(testItem));
        when(productServiceClient.bulkGetProducts(any(BulkProductRequest.class)))
                .thenReturn(BulkProductResponse.builder().products(Map.of("prod-1", p)).build());

        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());

        assertEquals(0, response.getSynced().size());
        assertEquals(1, response.getErrors().size());
        assertEquals("INSUFFICIENT_STOCK", response.getErrors().get(0).getReason());
    }

    @Test
    void shouldReturnEmpty_WhenNoItemsToSync() {
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of());
        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());
        assertEquals(0, response.getSynced().size());
        assertEquals(0, response.getErrors().size());
        verifyNoInteractions(productServiceClient);
    }
}
