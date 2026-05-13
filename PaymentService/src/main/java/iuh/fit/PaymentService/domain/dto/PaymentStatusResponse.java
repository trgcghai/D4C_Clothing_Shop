package iuh.fit.PaymentService.domain.dto;

import iuh.fit.PaymentService.domain.enums.PaymentStatus;

import java.time.Instant;

public class PaymentStatusResponse {

    private Long paymentId;
    private PaymentStatus status;
    private Instant paidAt;

    public PaymentStatusResponse() {}

    public PaymentStatusResponse(Long paymentId, PaymentStatus status, Instant paidAt) {
        this.paymentId = paymentId;
        this.status = status;
        this.paidAt = paidAt;
    }

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    public Instant getPaidAt() { return paidAt; }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
}
