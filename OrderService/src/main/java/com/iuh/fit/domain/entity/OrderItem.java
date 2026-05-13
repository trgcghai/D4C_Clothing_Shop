package com.iuh.fit.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "product_id", length = 36)
    private String productId;

    @Column(name = "color", length = 64)
    private String color;

    @Column(name = "size", length = 64)
    private String size;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 19, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "line_total", precision = 19, scale = 2, nullable = false)
    private BigDecimal lineTotal;

    @Column(name = "snapshot_product_name", length = 255)
    private String snapshotProductName;

    @Column(name = "snapshot_variant_sku", length = 128)
    private String snapshotVariantSku;

    @Column(name = "variant_id", length = 128)
    private String variantId;

    @Column(name = "snapshot_price_at_checkout", precision = 19, scale = 2)
    private BigDecimal snapshotPriceAtCheckout;
}
