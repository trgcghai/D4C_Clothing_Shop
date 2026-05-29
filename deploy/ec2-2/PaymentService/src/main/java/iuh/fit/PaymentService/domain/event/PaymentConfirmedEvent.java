package iuh.fit.PaymentService.domain.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PaymentConfirmedEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Long sepayTransactionId;
    private String sepayGateway;
    private Instant paidAt;
}
