package iuh.fit.PaymentService.domain.dto;

import iuh.fit.PaymentService.domain.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreatePaymentRequest {

    @NotNull(message = "Order ID is required")
    private Long orderId;

    @NotNull(message = "Checkout order ID is required")
    private String checkoutOrderId;

    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be positive")
    private Long amount;

    @NotNull(message = "Payment method is required")
    private PaymentMethod method;

    public CreatePaymentRequest() {}
}
