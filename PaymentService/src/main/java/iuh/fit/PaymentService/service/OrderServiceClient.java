package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.exception.PaymentException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class OrderServiceClient {

    private static final Logger log = LoggerFactory.getLogger(OrderServiceClient.class);

    @Value("${order.service.url}")
    private String orderServiceUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public OrderServiceClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
    }

    public void updateOrderStatus(Long orderId, String status) {
        String url = orderServiceUrl + "/api/public/orders/" + orderId + "/status";

        try {
            JsonNode body = objectMapper.createObjectNode()
                    .put("status", status);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> request = new HttpEntity<>(body.toString(), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new PaymentException("Failed to update order status: " + response.getStatusCode());
            }

            log.info("Order {} status updated to {} via OrderService", orderId, status);
        } catch (PaymentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error calling OrderService to update order {}: {}", orderId, e.getMessage());
            throw new PaymentException("Failed to communicate with OrderService: " + e.getMessage());
        }
    }

    public Long getOrderUserId(Long orderId) {
        String url = orderServiceUrl + "/api/public/orders/" + orderId + "/owner";

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Void> request = new HttpEntity<>(headers);

            ResponseEntity<Long> response = restTemplate.exchange(
                    url, HttpMethod.GET, request, Long.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new PaymentException("Failed to fetch order owner: " + orderId);
            }

            return response.getBody();
        } catch (PaymentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error calling OrderService to get order {} userId: {}", orderId, e.getMessage());
            throw new PaymentException("Failed to communicate with OrderService: " + e.getMessage());
        }
    }
}
