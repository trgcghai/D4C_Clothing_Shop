package com.iuh.fit.service;

import com.iuh.fit.client.ProductClient;
import com.iuh.fit.client.dto.BatchStockRequest;
import com.iuh.fit.client.dto.BatchStockResponse;
import com.iuh.fit.domain.dto.CreateOrderFromCheckoutRequest;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceCheckoutTest {

    @Mock private OrderRepository orderRepository;
    @Mock private ProductClient productClient;
    @Mock private OrderEventPublisher orderEventPublisher;
    @Mock private AuditService auditService;

    @InjectMocks private OrderService orderService;

    private CreateOrderFromCheckoutRequest createRequest() {
        CreateOrderFromCheckoutRequest req = new CreateOrderFromCheckoutRequest();
        req.setOrderId("checkout-123");
        CreateOrderFromCheckoutRequest.CheckoutItemDto item = new CreateOrderFromCheckoutRequest.CheckoutItemDto();
        item.setVariantId("var_1");
        item.setProductId("prod_1");
        item.setProductName("Test Product");
        item.setQuantity(2);
        item.setColor("Red");
        item.setSize("M");
        CreateOrderFromCheckoutRequest.SnapshotDto snapshot = new CreateOrderFromCheckoutRequest.SnapshotDto();
        snapshot.setPriceAtCheckout(new BigDecimal("100.00"));
        snapshot.setProductName("Test Product");
        snapshot.setVariantSku("SKU-001");
        item.setSnapshot(snapshot);
        req.setItems(List.of(item));
        req.setTotalAmount(new BigDecimal("200.00"));
        req.setPaymentMethod("CASH");
        req.setShippingStreet("123 Test St");
        req.setShippingWard("Ward 1");
        req.setShippingProvince("Test Province");
        return req;
    }

    @Test
    void shouldRestoreStockWhenOrderSaveFails() {
        CreateOrderFromCheckoutRequest request = createRequest();
        when(orderRepository.findByUserIdAndCheckoutOrderId(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(productClient.batchDeductStock(anyList()))
                .thenReturn(new BatchStockResponse(true, null));
        when(productClient.batchRestoreStock(anyList()))
                .thenReturn(new BatchStockResponse(true, null));
        when(orderRepository.save(any(Order.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> orderService.createOrderFromCheckout(1L, "test@email.com", request))
                .isInstanceOf(DataIntegrityViolationException.class);

        verify(productClient).batchRestoreStock(anyList());
    }

    @Test
    void shouldPublishStockRestoreFailedWhenCompensationAlsoFails() {
        CreateOrderFromCheckoutRequest request = createRequest();
        when(orderRepository.findByUserIdAndCheckoutOrderId(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(productClient.batchDeductStock(anyList()))
                .thenReturn(new BatchStockResponse(true, null));
        when(productClient.batchRestoreStock(anyList()))
                .thenThrow(new RuntimeException("ProductService down"));
        when(orderRepository.save(any(Order.class)))
                .thenThrow(new DataIntegrityViolationException("DB error"));

        assertThatThrownBy(() -> orderService.createOrderFromCheckout(1L, "test@email.com", request))
                .isInstanceOf(DataIntegrityViolationException.class);

        verify(orderEventPublisher).publishStockRestoreFailed(anyList(), anyString());
    }
}
