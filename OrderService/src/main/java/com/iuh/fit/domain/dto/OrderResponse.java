package com.iuh.fit.domain.dto;

import com.iuh.fit.domain.enums.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class OrderResponse {
    private Long id;
    private String checkoutOrderId;
    private Long userId;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private List<OrderItemResponse> items;
    private Instant createdAt;
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCheckoutOrderId() {
        return checkoutOrderId;
    }

    public void setCheckoutOrderId(String checkoutOrderId) {
        this.checkoutOrderId = checkoutOrderId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public List<OrderItemResponse> getItems() {
        return items;
    }

    public void setItems(List<OrderItemResponse> items) {
        this.items = items;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public static class OrderItemResponse {
        private Long id;
        private String productName;
        private String color;
        private String size;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal lineTotal;
        private String snapshotProductName;
        private String snapshotVariantSku;
        private BigDecimal snapshotPriceAtCheckout;

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getProductName() {
            return productName;
        }

        public void setProductName(String productName) {
            this.productName = productName;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }

        public String getSize() {
            return size;
        }

        public void setSize(String size) {
            this.size = size;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }

        public BigDecimal getUnitPrice() {
            return unitPrice;
        }

        public void setUnitPrice(BigDecimal unitPrice) {
            this.unitPrice = unitPrice;
        }

        public BigDecimal getLineTotal() {
            return lineTotal;
        }

        public void setLineTotal(BigDecimal lineTotal) {
            this.lineTotal = lineTotal;
        }

        public String getSnapshotProductName() {
            return snapshotProductName;
        }

        public void setSnapshotProductName(String snapshotProductName) {
            this.snapshotProductName = snapshotProductName;
        }

        public String getSnapshotVariantSku() {
            return snapshotVariantSku;
        }

        public void setSnapshotVariantSku(String snapshotVariantSku) {
            this.snapshotVariantSku = snapshotVariantSku;
        }

        public BigDecimal getSnapshotPriceAtCheckout() {
            return snapshotPriceAtCheckout;
        }

        public void setSnapshotPriceAtCheckout(BigDecimal snapshotPriceAtCheckout) {
            this.snapshotPriceAtCheckout = snapshotPriceAtCheckout;
        }
    }
}
