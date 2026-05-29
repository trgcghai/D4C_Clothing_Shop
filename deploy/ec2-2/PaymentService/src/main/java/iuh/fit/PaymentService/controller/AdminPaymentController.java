package iuh.fit.PaymentService.controller;

import iuh.fit.PaymentService.domain.dto.PaymentResponse;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/payments")
@Tag(name = "Admin Payments", description = "Admin payment management APIs")
@SecurityRequirement(name = "bearerAuth")
public class AdminPaymentController {

    @Autowired
    private PaymentService paymentService;

    @GetMapping
    @Operation(summary = "List all payments", description = "Get paginated list of all payments with optional status filter")
    public ResponseEntity<Page<PaymentResponse>> listPayments(
            @RequestParam(required = false) PaymentStatus status,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<PaymentResponse> payments;
        if (status != null) {
            payments = paymentService.getPaymentsByStatus(status, pageable);
        } else {
            payments = paymentService.getAllPayments(pageable);
        }
        return ResponseEntity.ok(payments);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get payment details", description = "Get full payment information by ID")
    public ResponseEntity<PaymentResponse> getPayment(@PathVariable Long id) {
        return ResponseEntity.ok(paymentService.getPaymentById(id));
    }
}
