package com.iuh.fit.domain.dto;

import java.time.Instant;

public class PaymentConfirmedEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Long sepayTransactionId;
    private String sepayGateway;
    private Instant paidAt;

    public PaymentConfirmedEvent() {}

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
    public Long getSepayTransactionId() { return sepayTransactionId; }
    public void setSepayTransactionId(Long sepayTransactionId) { this.sepayTransactionId = sepayTransactionId; }
    public String getSepayGateway() { return sepayGateway; }
    public void setSepayGateway(String sepayGateway) { this.sepayGateway = sepayGateway; }
    public Instant getPaidAt() { return paidAt; }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
}
