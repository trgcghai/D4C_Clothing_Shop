package iuh.fit.PaymentService.domain.event;

import java.time.Instant;

public class PaymentCancelledEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Instant cancelledAt;

    public PaymentCancelledEvent() {}

    public PaymentCancelledEvent(Long paymentId, Long orderId, String checkoutOrderId,
                                  String paymentCode, Long amount, Instant cancelledAt) {
        this.paymentId = paymentId;
        this.orderId = orderId;
        this.checkoutOrderId = checkoutOrderId;
        this.paymentCode = paymentCode;
        this.amount = amount;
        this.cancelledAt = cancelledAt;
    }

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public String getPaymentCode() { return paymentCode; }
    public void setPaymentCode(String paymentCode) { this.paymentCode = paymentCode; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
}
