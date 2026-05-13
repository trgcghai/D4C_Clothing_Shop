package com.iuh.fit.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class UserServiceClient {

    private static final Logger log = LoggerFactory.getLogger(UserServiceClient.class);

    @Value("${user.service.url:http://userservice:8081}")
    private String userServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public String getUserEmail(Long userId) {
        String url = userServiceUrl + "/api/admin/users/" + userId;
        try {
            ResponseEntity<JsonNode> response = restTemplate.getForEntity(url, JsonNode.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode body = response.getBody();
                if (body.has("email")) {
                    return body.get("email").asText();
                }
            }
            log.warn("Email not found in response from UserService for userId {}", userId);
            return null;
        } catch (Exception e) {
            log.error("Error calling UserService to get email for userId {}: {}", userId, e.getMessage());
            return null;
        }
    }
}
