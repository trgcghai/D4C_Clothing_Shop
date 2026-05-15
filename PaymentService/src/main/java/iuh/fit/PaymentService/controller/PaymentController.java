package iuh.fit.PaymentService.controller;

import iuh.fit.PaymentService.domain.dto.CreatePaymentRequest;
import iuh.fit.PaymentService.domain.dto.PaymentResponse;
import iuh.fit.PaymentService.domain.dto.PaymentStatusResponse;
import iuh.fit.PaymentService.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@Tag(name = "Payments", description = "Payment management APIs")
@SecurityRequirement(name = "bearerAuth")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @PostMapping
    @Operation(summary = "Create a new payment", description = "Create payment record and return QR URL for QR method")
    public ResponseEntity<PaymentResponse> createPayment(@Valid @RequestBody CreatePaymentRequest request) {
        PaymentResponse response = paymentService.createPayment(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get payment details", description = "Get full payment information by ID")
    public ResponseEntity<PaymentResponse> getPayment(@PathVariable Long id) {
        return ResponseEntity.ok(paymentService.getPaymentById(id));
    }

    @GetMapping
    @Operation(summary = "Get payment by orderId query param", description = "Get payment details by orderId query parameter")
    public ResponseEntity<PaymentResponse> getPaymentByOrderId(@RequestParam Long orderId) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getPrincipal() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Object principal = authentication.getPrincipal();
        Long requestingUserId = principal instanceof Long ? (Long) principal : null;
        if (requestingUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(paymentService.getPaymentByOrderId(orderId, requestingUserId));
    }

    @GetMapping("/{id}/status")
    @Operation(summary = "Get payment status", description = "Get current payment status for polling")
    public ResponseEntity<PaymentStatusResponse> getPaymentStatus(@PathVariable Long id) {
        return ResponseEntity.ok(paymentService.getPaymentStatus(id));
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a payment", description = "Cancel a pending payment")
    public ResponseEntity<PaymentStatusResponse> cancelPayment(@PathVariable Long id) {
        return ResponseEntity.ok(paymentService.cancelPayment(id));
    }
}
