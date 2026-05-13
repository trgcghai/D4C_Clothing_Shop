package com.iuh.fit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ProductServiceClient {

    private static final Logger log = LoggerFactory.getLogger(ProductServiceClient.class);

    @Value("${product.service.url:http://productservice:8082}")
    private String productServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void restoreStock(String variantId, int quantity) {
        String url = productServiceUrl + "/api/products/variants/" + variantId + "/restore-stock";

        try {
            JsonNode body = objectMapper.createObjectNode()
                    .put("quantity", quantity);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> request = new HttpEntity<>(body.toString(), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                log.warn("Failed to restore stock for variant {}: {}", variantId, response.getStatusCode());
            } else {
                log.info("Restored {} units for variant {}", quantity, variantId);
            }
        } catch (Exception e) {
            log.error("Error calling ProductService to restore stock for variant {}: {}", variantId, e.getMessage());
        }
    }
}
