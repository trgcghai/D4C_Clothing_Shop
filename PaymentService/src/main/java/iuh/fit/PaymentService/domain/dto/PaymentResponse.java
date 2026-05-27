package iuh.fit.PaymentService.domain.dto;

import iuh.fit.PaymentService.domain.enums.PaymentMethod;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class PaymentResponse {

    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private PaymentMethod method;
    private PaymentStatus status;
    private String qrUrl;
    private Instant expiresAt;
    private Instant createdAt;
    private Long sepayTransactionId;
    private String sepayGateway;
    private Instant paidAt;

    public PaymentResponse() {}
}
