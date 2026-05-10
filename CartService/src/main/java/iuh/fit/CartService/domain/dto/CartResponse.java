package iuh.fit.CartService.domain.dto;

import java.math.BigDecimal;
import java.util.List;

public class CartResponse {

    private Long cartId;
    private Long userId;
    private List<CartItemDto> items;
    private BigDecimal totalAmount;
    private Integer totalItems;

    public CartResponse() {}

    public Long getCartId() { return cartId; }
    public void setCartId(Long cartId) { this.cartId = cartId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public List<CartItemDto> getItems() { return items; }
    public void setItems(List<CartItemDto> items) { this.items = items; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public Integer getTotalItems() { return totalItems; }
    public void setTotalItems(Integer totalItems) { this.totalItems = totalItems; }

    public static CartResponseBuilder builder() {
        return new CartResponseBuilder();
    }

    public static class CartResponseBuilder {
        private Long cartId;
        private Long userId;
        private List<CartItemDto> items;
        private BigDecimal totalAmount;
        private Integer totalItems;

        CartResponseBuilder() {}

        public CartResponseBuilder cartId(Long cartId) { this.cartId = cartId; return this; }
        public CartResponseBuilder userId(Long userId) { this.userId = userId; return this; }
        public CartResponseBuilder items(List<CartItemDto> items) { this.items = items; return this; }
        public CartResponseBuilder totalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; return this; }
        public CartResponseBuilder totalItems(Integer totalItems) { this.totalItems = totalItems; return this; }
        public CartResponse build() {
            CartResponse r = new CartResponse();
            r.cartId = cartId; r.userId = userId; r.items = items; r.totalAmount = totalAmount; r.totalItems = totalItems;
            return r;
        }
    }

    public static class CartItemDto {
        private Long id;
        private String variantId;
        private String productName;
        private String color;
        private String size;
        private BigDecimal price;
        private Integer quantity;
        private BigDecimal subtotal;
        private String sku;

        public CartItemDto() {}

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getVariantId() { return variantId; }
        public void setVariantId(String variantId) { this.variantId = variantId; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
        public String getSize() { return size; }
        public void setSize(String size) { this.size = size; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }
        public BigDecimal getSubtotal() { return subtotal; }
        public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
        public String getSku() { return sku; }
        public void setSku(String sku) { this.sku = sku; }

        public static CartItemDtoBuilder builder() { return new CartItemDtoBuilder(); }

        public static class CartItemDtoBuilder {
            private Long id; private String variantId; private String productName;
            private String color; private String size; private BigDecimal price;
            private Integer quantity; private BigDecimal subtotal; private String sku;

            CartItemDtoBuilder() {}

            public CartItemDtoBuilder id(Long id) { this.id = id; return this; }
            public CartItemDtoBuilder variantId(String variantId) { this.variantId = variantId; return this; }
            public CartItemDtoBuilder productName(String productName) { this.productName = productName; return this; }
            public CartItemDtoBuilder color(String color) { this.color = color; return this; }
            public CartItemDtoBuilder size(String size) { this.size = size; return this; }
            public CartItemDtoBuilder price(BigDecimal price) { this.price = price; return this; }
            public CartItemDtoBuilder quantity(Integer quantity) { this.quantity = quantity; return this; }
            public CartItemDtoBuilder subtotal(BigDecimal subtotal) { this.subtotal = subtotal; return this; }
            public CartItemDtoBuilder sku(String sku) { this.sku = sku; return this; }
            public CartItemDto build() {
                CartItemDto d = new CartItemDto();
                d.id = id; d.variantId = variantId; d.productName = productName; d.color = color;
                d.size = size; d.price = price; d.quantity = quantity; d.subtotal = subtotal; d.sku = sku;
                return d;
            }
        }
    }
}
