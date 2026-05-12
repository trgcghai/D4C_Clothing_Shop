package iuh.fit.PaymentService.domain.dto;

import iuh.fit.PaymentService.domain.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

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

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod method) { this.method = method; }
}
