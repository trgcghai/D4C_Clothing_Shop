package iuh.fit.CartService.domain.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "cart_items", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"cart_id", "variant_id"})
})
public class CartItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;

    @Column(name = "variant_id", nullable = false, length = 36)
    private String variantId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false, length = 50)
    private String color;

    @Column(nullable = false, length = 20)
    private String size;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer quantity;

    @Column(length = 100)
    private String sku;

    public CartItem() {}

    public CartItem(Long id, Cart cart, String variantId, String productName, String color, String size, BigDecimal price, Integer quantity, String sku) {
        this.id = id;
        this.cart = cart;
        this.variantId = variantId;
        this.productName = productName;
        this.color = color;
        this.size = size;
        this.price = price;
        this.quantity = quantity;
        this.sku = sku;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Cart getCart() { return cart; }
    public void setCart(Cart cart) { this.cart = cart; }
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
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public BigDecimal getSubtotal() {
        return price.multiply(BigDecimal.valueOf(quantity));
    }

    public static CartItemBuilder builder() {
        return new CartItemBuilder();
    }

    public static class CartItemBuilder {
        private Long id;
        private Cart cart;
        private String variantId;
        private String productName;
        private String color;
        private String size;
        private BigDecimal price;
        private Integer quantity;
        private String sku;

        CartItemBuilder() {}

        public CartItemBuilder id(Long id) { this.id = id; return this; }
        public CartItemBuilder cart(Cart cart) { this.cart = cart; return this; }
        public CartItemBuilder variantId(String variantId) { this.variantId = variantId; return this; }
        public CartItemBuilder productName(String productName) { this.productName = productName; return this; }
        public CartItemBuilder color(String color) { this.color = color; return this; }
        public CartItemBuilder size(String size) { this.size = size; return this; }
        public CartItemBuilder price(BigDecimal price) { this.price = price; return this; }
        public CartItemBuilder quantity(Integer quantity) { this.quantity = quantity; return this; }
        public CartItemBuilder sku(String sku) { this.sku = sku; return this; }
        public CartItem build() { return new CartItem(id, cart, variantId, productName, color, size, price, quantity, sku); }
    }
}
