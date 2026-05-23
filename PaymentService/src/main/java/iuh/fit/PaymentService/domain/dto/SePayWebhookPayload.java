package iuh.fit.PaymentService.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SePayWebhookPayload {

    private Long id;
    private String gateway;
    private String transactionDate;
    private String accountNumber;
    private String subAccount;
    private String code;
    private String content;

    @JsonProperty("transferType")
    private String transferType;

    private String description;

    @JsonProperty("transferAmount")
    private Long transferAmount;

    private Long accumulated;
    private String referenceCode;
}
