package iuh.fit.PaymentService.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "sepay")
public class SePayConfig {

    private String webhookSecret;
    private String apiKey;
    private String bankAccount;
    private String bankCode;
    private String paymentCodePrefix;

    public String getWebhookSecret() { return webhookSecret; }
    public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getBankAccount() { return bankAccount; }
    public void setBankAccount(String bankAccount) { this.bankAccount = bankAccount; }
    public String getBankCode() { return bankCode; }
    public void setBankCode(String bankCode) { this.bankCode = bankCode; }
    public String getPaymentCodePrefix() { return paymentCodePrefix; }
    public void setPaymentCodePrefix(String paymentCodePrefix) { this.paymentCodePrefix = paymentCodePrefix; }

    public String generateQrUrl(Long amount, String paymentCode) {
        return String.format(
                "https://qr.sepay.vn/img?acc=%s&bank=%s&amount=%d&des=%s",
                bankAccount, bankCode, amount, paymentCode
        );
    }

    public String generatePaymentCode() {
        String randomHex = String.format("%06x", (int) (Math.random() * 0xFFFFFF));
        return paymentCodePrefix + randomHex;
    }
}
