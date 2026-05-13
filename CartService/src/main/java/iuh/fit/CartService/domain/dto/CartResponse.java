package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartResponse {
    private Long cartId;
    private Long userId;
    private List<CartItemDto> items;
    private BigDecimal totalAmount;
    private Integer totalItems;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CartItemDto {
        private Long id;
        private String variantId;
        private String productId;
        private String productName;
        private String color;
        private String size;
        private BigDecimal price;
        private Integer quantity;
        private BigDecimal subtotal;
        private String sku;
        private String imageUrl;
    }
}
