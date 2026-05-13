package com.iuh.fit.domain.dto;

import com.iuh.fit.domain.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private Long id;
    private String checkoutOrderId;
    private Long userId;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private String paymentMethod;
    private List<OrderItemResponse> items;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemResponse {
        private Long id;
        private String productId;
        private String productName;
        private String color;
        private String size;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal lineTotal;
        private String snapshotProductName;
        private String snapshotVariantSku;
        private BigDecimal snapshotPriceAtCheckout;
    }
}
