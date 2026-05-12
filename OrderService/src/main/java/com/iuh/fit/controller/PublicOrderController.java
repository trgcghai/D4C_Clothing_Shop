package com.iuh.fit.controller;

import com.iuh.fit.domain.dto.UpdateOrderStatusRequest;
import com.iuh.fit.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/orders")
@Tag(name = "Public Order", description = "Public order APIs for service-to-service communication")
public class PublicOrderController {

    private final OrderService orderService;

    public PublicOrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/{id}/status")
    @Operation(summary = "Update order status (internal service call)")
    public ResponseEntity<Void> updateOrderStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStatusRequest request) {
        orderService.updateOrderStatusByPaymentService(id, request.getStatus());
        return ResponseEntity.ok().build();
    }
}
