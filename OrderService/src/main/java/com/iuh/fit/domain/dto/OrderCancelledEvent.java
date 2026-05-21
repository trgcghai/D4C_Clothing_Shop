package com.iuh.fit.domain.dto;

import java.util.List;

public class OrderCancelledEvent {
    private Long orderId;
    private Long userId;
    private String checkoutOrderId;
    private List<OrderItemSnapshot> items;

    public OrderCancelledEvent() {}

    public OrderCancelledEvent(Long orderId, Long userId, String checkoutOrderId, List<OrderItemSnapshot> items) {
        this.orderId = orderId;
        this.userId = userId;
        this.checkoutOrderId = checkoutOrderId;
        this.items = items;
    }

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public List<OrderItemSnapshot> getItems() { return items; }
    public void setItems(List<OrderItemSnapshot> items) { this.items = items; }

    public static class OrderItemSnapshot {
        private String variantId;
        private int quantity;

        public OrderItemSnapshot() {}

        public OrderItemSnapshot(String variantId, int quantity) {
            this.variantId = variantId;
            this.quantity = quantity;
        }

        public String getVariantId() { return variantId; }
        public void setVariantId(String variantId) { this.variantId = variantId; }
        public int getQuantity() { return quantity; }
        public void setQuantity(int quantity) { this.quantity = quantity; }
    }
}
