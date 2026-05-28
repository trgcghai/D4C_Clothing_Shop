package iuh.fit.PaymentService.controller;

import iuh.fit.PaymentService.service.WebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.util.Map;

@RestController
@RequestMapping("/api/webhooks")
@Tag(name = "Webhooks", description = "SePay webhook receiver")
public class WebhookController {

    private static final Logger log = LoggerFactory.getLogger(WebhookController.class);

    @Autowired
    private WebhookService webhookService;

    @PostMapping("/sepay")
    @Operation(summary = "Receive SePay webhook", description = "Handle incoming SePay payment notifications with HMAC-SHA256 verification")
    public ResponseEntity<Map<String, Boolean>> handleSePayWebhook(
            @RequestHeader(value = "X-SePay-Signature", required = false) String signature,
            @RequestHeader(value = "X-SePay-Timestamp", required = false) String timestamp,
            HttpServletRequest request) {

        String rawBody = readRawBody(request);
        log.info("SePay webhook received - signature present: {}, timestamp: {}", signature != null, timestamp);

        if (!webhookService.verifyHmacSignature(rawBody, timestamp, signature)) {
            log.warn("HMAC verification failed for webhook");
            return ResponseEntity.status(401).body(Map.of("success", false));
        }

        try {
            boolean success = webhookService.processWebhook(rawBody);
            if (success) {
                return ResponseEntity.ok(Map.of("success", true));
            }
            return ResponseEntity.status(500).body(Map.of("success", false));
        } catch (Exception e) {
            log.error("Error processing SePay webhook", e);
            return ResponseEntity.status(500).body(Map.of("success", false));
        }
    }

    private String readRawBody(HttpServletRequest request) {
        try {
            StringBuilder sb = new StringBuilder();
            BufferedReader reader = request.getReader();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to read request body", e);
        }
    }
}
