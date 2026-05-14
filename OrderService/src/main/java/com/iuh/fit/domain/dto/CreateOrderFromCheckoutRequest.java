package com.iuh.fit.domain.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
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
public class CreateOrderFromCheckoutRequest {

    @NotBlank
    private String orderId;

    @NotEmpty
    @Valid
    private List<CheckoutItemDto> items;

    @NotNull
    private BigDecimal totalAmount;

    private String paymentMethod;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CheckoutItemDto {
        @NotBlank
        private String productName;
        private String productId;
        private String variantId;
        private String color;
        private String size;
        private BigDecimal price;
        @NotNull
        private Integer quantity;
        @NotNull
        @Valid
        private SnapshotDto snapshot;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SnapshotDto {
        @NotNull
        private BigDecimal priceAtCheckout;
        private String productName;
        private String variantSku;
    }
}
