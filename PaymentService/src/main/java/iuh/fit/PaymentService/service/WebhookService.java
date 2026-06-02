package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.config.SePayConfig;
import iuh.fit.PaymentService.domain.dto.SePayWebhookPayload;
import iuh.fit.PaymentService.domain.entity.UnmatchedPayment;
import iuh.fit.PaymentService.domain.entity.WebhookLog;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.exception.PaymentException;
import iuh.fit.PaymentService.repository.UnmatchedPaymentRepository;
import iuh.fit.PaymentService.repository.WebhookLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

@Service
public class WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
    private static final DateTimeFormatter SEPAY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long MAX_TRANSACTION_AGE_HOURS = 24;

    @Autowired
    private WebhookLogRepository webhookLogRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private SePayConfig sePayConfig;

    @Autowired
    private UnmatchedPaymentRepository unmatchedPaymentRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean verifyHmacSignature(String rawBody, String timestamp, String signature) {
        if (signature == null || signature.isBlank() || timestamp == null || timestamp.isBlank()) {
            log.warn("Missing signature or timestamp headers");
            return false;
        }

        String secret = sePayConfig.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            log.error("SEPAY_WEBHOOK_SECRET is not configured");
            return false;
        }

        try {
            String stringToSign = timestamp + "." + rawBody;
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(keySpec);
            byte[] hash = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
            String expected = "sha256=" + bytesToHex(hash);
            boolean valid = expected.equals(signature);
            if (!valid) {
                log.warn("HMAC mismatch - expected: {}, received: {}", expected, signature);
            }
            return valid;
        } catch (Exception e) {
            log.error("HMAC verification failed", e);
            return false;
        }
    }

    @Transactional(noRollbackFor = PaymentException.class)
    public boolean processWebhook(String rawBody) {
        SePayWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, SePayWebhookPayload.class);
        } catch (Exception e) {
            log.error("Failed to parse webhook payload", e);
            throw new PaymentException("Invalid webhook payload");
        }

        log.info("Processing webhook - id: {}, code: {}, content: {}, amount: {}, transferType: {}",
                payload.getId(), payload.getCode(), payload.getContent(),
                payload.getTransferAmount(), payload.getTransferType());

        if (isReplayAttack(payload)) {
            log.warn("Replay attack detected - transaction too old: {}", payload.getTransactionDate());
            return true;
        }

        if (webhookLogRepository.findByTransactionId(payload.getId()).isPresent()) {
            log.info("Duplicate webhook, transaction already processed: {}", payload.getId());
            return true;
        }

        if (!validateContent(payload)) {
            log.warn("Content validation failed for webhook: {}", payload.getId());
            return true;
        }

        if (!"in".equals(payload.getTransferType())) {
            log.info("Ignoring outgoing transaction: {}", payload.getId());
            return true;
        }

        String webhookCode = extractPaymentCode(payload);
        if (webhookCode == null || webhookCode.isBlank()) {
            log.warn("No payment code found in webhook: {}", payload.getId());
            return true;
        }

        String paymentCode = resolvePaymentCode(webhookCode, payload.getTransferAmount());
        if (paymentCode == null) {
            log.warn("No matching pending payment found for webhook code: {}", webhookCode);
            try {
                String payloadJson = objectMapper.writeValueAsString(payload);
                UnmatchedPayment unmatched = UnmatchedPayment.builder()
                        .sepayTransactionId(String.valueOf(payload.getId()))
                        .payload(payloadJson)
                        .build();
                unmatchedPaymentRepository.save(unmatched);
                log.info("Saved unmatched webhook transaction {} for reconciliation", payload.getId());
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize unmatched webhook payload: {}", e.getMessage());
            }
            return true;
        }

        try {
            paymentService.markAsPaid(paymentCode, payload.getId(), payload.getGateway());
            log.info("Payment marked as PAID: {} (SePay tx: {})", paymentCode, payload.getId());

            WebhookLog webhookLog = new WebhookLog();
            webhookLog.setTransactionId(payload.getId());
            webhookLog.setBody(rawBody);
            webhookLogRepository.save(webhookLog);
        } catch (PaymentException e) {
            log.warn("Payment processing warning for code {}: {}", paymentCode, e.getMessage());
        }

        return true;
    }

    private boolean isReplayAttack(SePayWebhookPayload payload) {
        if (payload.getTransactionDate() == null || payload.getTransactionDate().isBlank()) {
            return false;
        }

        try {
            LocalDateTime transactionTime = LocalDateTime.parse(payload.getTransactionDate(), SEPAY_DATE_FORMAT);
            Instant transactionInstant = transactionTime.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
            long hoursAgo = ChronoUnit.HOURS.between(transactionInstant, Instant.now());

            if (hoursAgo > MAX_TRANSACTION_AGE_HOURS) {
                log.warn("Transaction is {} hours old (max: {})", hoursAgo, MAX_TRANSACTION_AGE_HOURS);
                return true;
            }
            return false;
        } catch (Exception e) {
            log.warn("Failed to parse transaction date: {}", payload.getTransactionDate());
            return false;
        }
    }

    private boolean validateContent(SePayWebhookPayload payload) {
        if (payload.getTransferAmount() == null || payload.getTransferAmount() <= 0) {
            log.warn("Invalid transfer amount: {}", payload.getTransferAmount());
            return false;
        }

        if (payload.getAccountNumber() != null && !payload.getAccountNumber().isBlank()) {
            String expectedAccount = sePayConfig.getBankAccount();
            if (expectedAccount != null && !expectedAccount.isBlank()
                    && !payload.getAccountNumber().equals(expectedAccount)) {
                log.warn("Account number mismatch - expected: {}, received: {}",
                        expectedAccount, payload.getAccountNumber());
                return false;
            }
        }

        return true;
    }

    private String extractPaymentCode(SePayWebhookPayload payload) {
        if (payload.getContent() != null && !payload.getContent().isBlank()) {
            String content = payload.getContent().trim();
            String[] parts = content.split("\\s+");
            if (parts.length > 0) {
                String candidate = parts[0];
                log.info("Extracted payment code from content: {}", candidate);
                return candidate;
            }
        }

        if (payload.getCode() != null && !payload.getCode().isBlank()) {
            log.info("Using payment code from code field: {}", payload.getCode());
            return payload.getCode();
        }

        return null;
    }

    private String resolvePaymentCode(String webhookCode, Long transferAmount) {
        String normalized = webhookCode.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        if (normalized.isEmpty()) {
            log.warn("Empty payment code after normalization");
            return null;
        }

        var payment = paymentService.findPaymentByPaymentCodeOrNull(normalized);
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
            if (!payment.getAmount().equals(transferAmount)) {
                log.warn("Amount mismatch for code={}: expected={}, received={}",
                        normalized, payment.getAmount(), transferAmount);
                return null;
            }
            log.info("Matched payment by normalized code: {}", normalized);
            return payment.getPaymentCode();
        }

        if (!webhookCode.equals(normalized)) {
            payment = paymentService.findPaymentByPaymentCodeOrNull(webhookCode);
            if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
                if (!payment.getAmount().equals(transferAmount)) {
                    log.warn("Amount mismatch for code={}: expected={}, received={}",
                            webhookCode, payment.getAmount(), transferAmount);
                    return null;
                }
                log.info("Matched payment by exact code: {}", webhookCode);
                return payment.getPaymentCode();
            }
        }

        log.warn("No matching pending payment for code: {}", webhookCode);
        return null;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
