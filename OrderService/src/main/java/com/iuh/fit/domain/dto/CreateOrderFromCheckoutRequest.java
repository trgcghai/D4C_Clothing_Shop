package com.iuh.fit.domain.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public class CreateOrderFromCheckoutRequest {

    @NotBlank
    private String orderId;

    @NotEmpty
    @Valid
    private List<CheckoutItemDto> items;

    @NotNull
    private BigDecimal totalAmount;

    private String paymentMethod;

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public List<CheckoutItemDto> getItems() {
        return items;
    }

    public void setItems(List<CheckoutItemDto> items) {
        this.items = items;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public static class CheckoutItemDto {
        @NotBlank
        private String productName;
        private String color;
        private String size;
        private BigDecimal price;
        @NotNull
        private Integer quantity;
        @NotNull
        @Valid
        private SnapshotDto snapshot;
        private String variantId;

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

        public BigDecimal getPrice() {
            return price;
        }

        public void setPrice(BigDecimal price) {
            this.price = price;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }

        public SnapshotDto getSnapshot() {
            return snapshot;
        }

        public void setSnapshot(SnapshotDto snapshot) {
            this.snapshot = snapshot;
        }

        public String getVariantId() {
            return variantId;
        }

        public void setVariantId(String variantId) {
            this.variantId = variantId;
        }
    }

    public static class SnapshotDto {
        @NotNull
        private BigDecimal priceAtCheckout;
        private String productName;
        private String variantSku;

        public BigDecimal getPriceAtCheckout() {
            return priceAtCheckout;
        }

        public void setPriceAtCheckout(BigDecimal priceAtCheckout) {
            this.priceAtCheckout = priceAtCheckout;
        }

        public String getProductName() {
            return productName;
        }

        public void setProductName(String productName) {
            this.productName = productName;
        }

        public String getVariantSku() {
            return variantSku;
        }

        public void setVariantSku(String variantSku) {
            this.variantSku = variantSku;
        }
    }
}
