package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.config.SePayConfig;
import iuh.fit.PaymentService.domain.dto.SePayWebhookPayload;
import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.entity.WebhookLog;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.domain.event.PaymentConfirmedEvent;
import iuh.fit.PaymentService.exception.PaymentException;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
import iuh.fit.PaymentService.repository.PaymentRepository;
import iuh.fit.PaymentService.repository.WebhookLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.UUID;

@Service
public class WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
    private static final DateTimeFormatter SEPAY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long MAX_TRANSACTION_AGE_HOURS = 24;

    @Autowired
    private WebhookLogRepository webhookLogRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private SePayConfig sePayConfig;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private OutboxEventRepository outboxRepository;

    @Value("${feature.outbox.enabled:false}")
    private boolean outboxEnabled;

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
            return true;
        }

        try {
            var statusResponse = paymentService.markAsPaid(paymentCode, payload.getId(), payload.getGateway());

            if (statusResponse.getStatus() == PaymentStatus.PAID) {
                log.info("Payment marked as PAID: {} (SePay tx: {})", paymentCode, payload.getId());

                var payment = paymentService.findPaymentByPaymentCodeOrNull(paymentCode);
                if (payment != null) {
                    PaymentConfirmedEvent event = new PaymentConfirmedEvent(
                            payment.getId(),
                            payment.getOrderId(),
                            payment.getCheckoutOrderId(),
                            payment.getPaymentCode(),
                            payment.getAmount(),
                            payload.getId(),
                            payload.getGateway(),
                            Instant.now()
                    );
                    publishPaymentConfirmedEvent(event);
                    log.info("Published PaymentConfirmedEvent for payment: {}", payment.getId());
                } else {
                    log.warn("Payment found but is null for code: {}", paymentCode);
                }
            }

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

        var payment = paymentService.findPaymentByPaymentCodeOrNull(normalized);
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
            log.info("Matched payment by normalized code: {}", normalized);
            return payment.getPaymentCode();
        }

        payment = paymentService.findPaymentByPaymentCodeOrNull(webhookCode);
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
            log.info("Matched payment by exact code: {}", webhookCode);
            return payment.getPaymentCode();
        }

        if (transferAmount != null) {
            var pendingPayments = paymentRepository.findPendingByAmount(transferAmount);
            for (var p : pendingPayments) {
                String storedNormalized = p.getPaymentCode().replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
                if (storedNormalized.equals(normalized) || storedNormalized.contains(normalized) || normalized.contains(storedNormalized)) {
                    if (transferAmount < p.getAmount()) {
                        log.warn("Amount mismatch for payment {}: expected={}, received={}",
                                p.getPaymentCode(), p.getAmount(), transferAmount);
                        continue;
                    }
                    log.info("Matched payment by amount+code fuzzy: {} (amount: {})", p.getPaymentCode(), transferAmount);
                    return p.getPaymentCode();
                }
            }
        }

        return null;
    }

    private void publishPaymentConfirmedEvent(PaymentConfirmedEvent event) {
        if (outboxEnabled) {
            try {
                String payload = objectMapper.writeValueAsString(event);
                OutboxEvent outboxEvent = OutboxEvent.builder()
                        .eventType("PAYMENT_CONFIRMED")
                        .eventId(UUID.randomUUID().toString())
                        .aggregateId(event.getPaymentId())
                        .payload(payload)
                        .exchange(RabbitMQConfig.PAYMENT_EXCHANGE)
                        .routingKey(RabbitMQConfig.PAYMENT_CONFIRMED_ROUTING_KEY)
                        .build();
                outboxRepository.save(outboxEvent);
                log.debug("Saved PAYMENT_CONFIRMED event to outbox for paymentId={}", event.getPaymentId());
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize PAYMENT_CONFIRMED event: {}", e.getMessage());
            }
        } else {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.PAYMENT_EXCHANGE,
                    RabbitMQConfig.PAYMENT_CONFIRMED_ROUTING_KEY,
                    event
            );
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
