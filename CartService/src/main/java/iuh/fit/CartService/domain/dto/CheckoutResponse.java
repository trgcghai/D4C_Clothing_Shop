package iuh.fit.CartService.domain.dto;

import java.math.BigDecimal;
import java.util.List;

public class CheckoutResponse {

    private String orderId;
    private String status;
    private List<CheckoutItem> items;
    private BigDecimal totalAmount;

    public CheckoutResponse() {}

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public List<CheckoutItem> getItems() { return items; }
    public void setItems(List<CheckoutItem> items) { this.items = items; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public static CheckoutResponseBuilder builder() {
        return new CheckoutResponseBuilder();
    }

    public static class CheckoutResponseBuilder {
        private String orderId; private String status;
        private List<CheckoutItem> items; private BigDecimal totalAmount;

        CheckoutResponseBuilder() {}

        public CheckoutResponseBuilder orderId(String orderId) { this.orderId = orderId; return this; }
        public CheckoutResponseBuilder status(String status) { this.status = status; return this; }
        public CheckoutResponseBuilder items(List<CheckoutItem> items) { this.items = items; return this; }
        public CheckoutResponseBuilder totalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; return this; }
        public CheckoutResponse build() {
            CheckoutResponse r = new CheckoutResponse();
            r.orderId = orderId; r.status = status; r.items = items; r.totalAmount = totalAmount;
            return r;
        }
    }

    public static class CheckoutItem {
        private String variantId;
        private String productName; private String color; private String size;
        private BigDecimal price; private Integer quantity; private Snapshot snapshot;

        public CheckoutItem() {}

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
        public Snapshot getSnapshot() { return snapshot; }
        public void setSnapshot(Snapshot snapshot) { this.snapshot = snapshot; }

        public static CheckoutItemBuilder builder() { return new CheckoutItemBuilder(); }

        public static class CheckoutItemBuilder {
            private String variantId;
            private String productName; private String color; private String size;
            private BigDecimal price; private Integer quantity; private Snapshot snapshot;

            CheckoutItemBuilder() {}

            public CheckoutItemBuilder variantId(String variantId) { this.variantId = variantId; return this; }
            public CheckoutItemBuilder productName(String productName) { this.productName = productName; return this; }
            public CheckoutItemBuilder color(String color) { this.color = color; return this; }
            public CheckoutItemBuilder size(String size) { this.size = size; return this; }
            public CheckoutItemBuilder price(BigDecimal price) { this.price = price; return this; }
            public CheckoutItemBuilder quantity(Integer quantity) { this.quantity = quantity; return this; }
            public CheckoutItemBuilder snapshot(Snapshot snapshot) { this.snapshot = snapshot; return this; }
            public CheckoutItem build() {
                CheckoutItem i = new CheckoutItem();
                i.variantId = variantId;
                i.productName = productName; i.color = color; i.size = size;
                i.price = price; i.quantity = quantity; i.snapshot = snapshot;
                return i;
            }
        }
    }

    public static class Snapshot {
        private BigDecimal priceAtCheckout; private String productName; private String variantSku;

        public Snapshot() {}

        public BigDecimal getPriceAtCheckout() { return priceAtCheckout; }
        public void setPriceAtCheckout(BigDecimal priceAtCheckout) { this.priceAtCheckout = priceAtCheckout; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getVariantSku() { return variantSku; }
        public void setVariantSku(String variantSku) { this.variantSku = variantSku; }

        public static SnapshotBuilder builder() { return new SnapshotBuilder(); }

        public static class SnapshotBuilder {
            private BigDecimal priceAtCheckout; private String productName; private String variantSku;

            SnapshotBuilder() {}

            public SnapshotBuilder priceAtCheckout(BigDecimal priceAtCheckout) { this.priceAtCheckout = priceAtCheckout; return this; }
            public SnapshotBuilder productName(String productName) { this.productName = productName; return this; }
            public SnapshotBuilder variantSku(String variantSku) { this.variantSku = variantSku; return this; }
            public Snapshot build() {
                Snapshot s = new Snapshot();
                s.priceAtCheckout = priceAtCheckout; s.productName = productName; s.variantSku = variantSku;
                return s;
            }
        }
    }
}
