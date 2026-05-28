package com.iuh.fit.controller;

import com.iuh.fit.domain.dto.PagedResponse;
import com.iuh.fit.domain.dto.OrderResponse;
import com.iuh.fit.domain.dto.UpdateOrderStatusRequest;
import com.iuh.fit.domain.entity.AuditLog;
import com.iuh.fit.service.AuditService;
import com.iuh.fit.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;

@RestController
@RequestMapping("/api/orders/admin")
@Tag(name = "AdminOrder", description = "Admin APIs for orders")
public class AdminOrderController {

    private final OrderService orderService;
    private final AuditService auditService;

    public AdminOrderController(OrderService orderService, AuditService auditService) {
        this.orderService = orderService;
        this.auditService = auditService;
    }

        @GetMapping
        @Operation(
            summary = "List orders (admin)",
            description = "Filter by status and createdAt range. Dates are ISO-8601 instants.",
            responses = {@ApiResponse(responseCode = "200", description = "Paged list of orders",
                content = @Content(mediaType = "application/json",
                    examples = @ExampleObject(value = "{\n  \"content\": [\n    {\n      \"id\": 123,\n      \"checkoutOrderId\": \"CHK-987\",\n      \"userId\": 45,\n      \"status\": \"PAID\",\n      \"totalAmount\": 199.99,\n      \"items\": [\n        {\n          \"id\": 1,\n          \"productName\": \"T-Shirt\",\n          \"color\": \"Blue\",\n          \"size\": \"M\",\n          \"quantity\": 2,\n          \"unitPrice\": 99.995,\n          \"lineTotal\": 199.99,\n          \"snapshotProductName\": \"T-Shirt\",\n          \"snapshotVariantSku\": \"TS-001-M\",\n          \"snapshotPriceAtCheckout\": 99.995\n        }\n      ],\n      \"createdAt\": \"2026-05-12T06:00:00Z\",\n      \"updatedAt\": \"2026-05-12T06:01:00Z\"\n    }\n  ],\n  \"page\": 1,\n  \"size\": 20,\n  \"totalElements\": 1,\n  \"totalPages\": 1,\n  \"first\": true,\n  \"last\": true\n}"
                    )
                )
            )}
        )
        public ResponseEntity<PagedResponse<OrderResponse>> listOrders(
            @Parameter(description = "Order status to filter", example = "PAID") @RequestParam(required = false) String status,
            @Parameter(description = "From createdAt (ISO-8601 instant)", example = "2026-05-01T00:00:00Z") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) String from,
            @Parameter(description = "To createdAt (ISO-8601 instant)", example = "2026-05-12T23:59:59Z") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) String to,
            @Parameter(description = "Page number (1-based)", example = "1") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Page size", example = "20") @RequestParam(defaultValue = "20") int size
        ) {
        com.iuh.fit.domain.enums.OrderStatus s = null;
        if (status != null && !status.isBlank()) {
            s = com.iuh.fit.domain.enums.OrderStatus.valueOf(status.toUpperCase());
        }

        Instant f = null;
        Instant t = null;
        try {
            if (from != null && !from.isBlank()) f = Instant.parse(from);
            if (to != null && !to.isBlank()) t = Instant.parse(to);
        } catch (DateTimeParseException e) {
            throw new com.iuh.fit.exception.BadRequestException("Invalid date format. Use ISO-8601 instants.");
        }

        return ResponseEntity.ok(orderService.getOrdersForAdmin(s, f, t, page, size));
    }

        @GetMapping("/{id}")
        @Operation(summary = "Get order detail (admin)", responses = {
            @ApiResponse(responseCode = "200", description = "Order detail",
                content = @Content(mediaType = "application/json",
                    examples = @ExampleObject(value = "{\n  \"id\": 123,\n  \"checkoutOrderId\": \"CHK-987\",\n  \"userId\": 45,\n  \"status\": \"PAID\",\n  \"totalAmount\": 199.99,\n      \"items\": [ { \"id\":1, \"productName\":\"T-Shirt\", \"quantity\":2, \"unitPrice\":99.995, \"lineTotal\":199.99 } ],\n  \"createdAt\": \"2026-05-12T06:00:00Z\",\n  \"updatedAt\": \"2026-05-12T06:01:00Z\"\n}"
                    )
                )
            )
        })
        public ResponseEntity<OrderResponse> getOrderDetail(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.getOrderByIdForAdmin(id));
        }

        @PatchMapping("/{id}/status")
        @io.swagger.v3.oas.annotations.parameters.RequestBody(
            description = "Status update payload",
            required = true,
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = UpdateOrderStatusRequest.class),
                examples = @ExampleObject(value = "{ \"status\": \"CANCELLED\", \"note\": \"Customer requested refund\" }")
            )
        )
        @Operation(summary = "Admin update order status", responses = {
            @ApiResponse(responseCode = "200", description = "Updated order",
                content = @Content(mediaType = "application/json",
                    examples = @ExampleObject(value = "{\n  \"id\": 123,\n  \"checkoutOrderId\": \"CHK-987\",\n  \"userId\": 45,\n  \"status\": \"CANCELLED\",\n  \"totalAmount\": 199.99,\n  \"createdAt\": \"2026-05-12T06:00:00Z\",\n  \"updatedAt\": \"2026-05-12T06:10:00Z\"\n}")
                )
            )
        })
        public ResponseEntity<OrderResponse> adminUpdateStatus(
            @RequestHeader("X-User-Id") Long adminId,
            @Parameter(description = "Order id") @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStatusRequest request
        ) {
        OrderResponse r = orderService.updateOrderStatusAsAdmin(adminId, id, request);
        return ResponseEntity.ok(r);
    }

        @GetMapping("/{id}/audits")
        @Operation(summary = "Get audit logs for an order", responses = {
            @ApiResponse(responseCode = "200", description = "Audit history",
                content = @Content(mediaType = "application/json",
                    examples = @ExampleObject(value = "[ { \"id\":1, \"orderId\":123, \"adminUserId\":999, \"previousStatus\":\"PAID\", \"newStatus\":\"CANCELLED\", \"note\":\"Fraudulent\", \"createdAt\":\"2026-05-12T06:10:00Z\" } ]")
                )
            )
        })
        public ResponseEntity<List<com.iuh.fit.domain.dto.AuditLogResponse>> getAudits(@PathVariable Long id) {
        List<com.iuh.fit.domain.entity.AuditLog> logs = auditService.findForOrder(id);
        List<com.iuh.fit.domain.dto.AuditLogResponse> resp = logs.stream().map(l -> {
            com.iuh.fit.domain.dto.AuditLogResponse r = new com.iuh.fit.domain.dto.AuditLogResponse();
            r.setId(l.getId());
            r.setOrderId(l.getOrderId());
            r.setAdminUserId(l.getAdminUserId());
            r.setPreviousStatus(l.getPreviousStatus());
            r.setNewStatus(l.getNewStatus());
            r.setNote(l.getNote());
            r.setCreatedAt(l.getCreatedAt());
            return r;
        }).toList();
        return ResponseEntity.ok(resp);
    }
}
