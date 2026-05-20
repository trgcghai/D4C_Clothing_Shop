package com.iuh.fit.domain.dto;

public class OrderPaidEvent {
    private Long orderId;
    private Long userId;
    private String checkoutOrderId;

    public OrderPaidEvent() {}

    public OrderPaidEvent(Long orderId, Long userId, String checkoutOrderId) {
        this.orderId = orderId;
        this.userId = userId;
        this.checkoutOrderId = checkoutOrderId;
    }

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
}
