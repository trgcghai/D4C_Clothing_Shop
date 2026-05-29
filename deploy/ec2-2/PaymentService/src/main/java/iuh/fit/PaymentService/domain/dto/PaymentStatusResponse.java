package iuh.fit.PaymentService.domain.dto;

import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PaymentStatusResponse {

    private Long paymentId;
    private PaymentStatus status;
    private Instant paidAt;
}
