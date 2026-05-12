package com.iuh.fit.controller;

import com.iuh.fit.domain.dto.CreateOrderFromCheckoutRequest;
import com.iuh.fit.domain.dto.OrderResponse;
import com.iuh.fit.domain.dto.PagedResponse;
import com.iuh.fit.domain.dto.UpdateOrderStatusRequest;
import com.iuh.fit.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Order", description = "Order management APIs")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @Operation(summary = "Create order from checkout snapshot", description = "Idempotent by checkout orderId, status starts at PENDING_PAYMENT.")
    public ResponseEntity<OrderResponse> createFromCheckout(
            Authentication authentication,
            @Valid @RequestBody CreateOrderFromCheckoutRequest request) {
        Long userId = extractUserId(authentication);
        OrderResponse response = orderService.createOrderFromCheckout(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "List my orders with pagination")
    public ResponseEntity<PagedResponse<OrderResponse>> getMyOrders(
            Authentication authentication,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(orderService.getMyOrders(userId, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get my order by id")
    public ResponseEntity<OrderResponse> getMyOrderById(
            Authentication authentication,
            @PathVariable Long id) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(orderService.getMyOrderById(userId, id));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update order status")
    public ResponseEntity<OrderResponse> updateStatus(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStatusRequest request) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(orderService.updateOrderStatus(userId, id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete my order")
    public ResponseEntity<Void> deleteOrder(Authentication authentication, @PathVariable Long id) {
        Long userId = extractUserId(authentication);
        orderService.deleteMyOrder(userId, id);
        return ResponseEntity.noContent().build();
    }

    private Long extractUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
