package iuh.fit.apigateway.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class JwksCache {

    private static final Logger log = LoggerFactory.getLogger(JwksCache.class);

    private final WebClient webClient;
    private final String jwksUrl;
    private final AtomicReference<PublicKey> publicKeyRef = new AtomicReference<>();

    public JwksCache(
            @Value("${gateway.jwks.url:http://userservice:8081/.well-known/jwks.json}") String jwksUrl) {
        this.jwksUrl = jwksUrl;
        this.webClient = WebClient.builder().build();
    }

    public void fetchAndCache() {
        try {
            Map<String, Object> jwks = webClient.get()
                    .uri(jwksUrl)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (jwks == null || !jwks.containsKey("keys")) {
                throw new IllegalStateException("Invalid JWKS response: missing 'keys'");
            }

            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> keys = (java.util.List<Map<String, Object>>) jwks.get("keys");
            if (keys.isEmpty()) {
                throw new IllegalStateException("JWKS response has no keys");
            }

            Map<String, Object> key = keys.get(0);
            String n = (String) key.get("n");
            String e = (String) key.get("e");

            byte[] modulusBytes = Base64.getUrlDecoder().decode(n);
            byte[] exponentBytes = Base64.getUrlDecoder().decode(e);

            java.math.BigInteger modulus = new java.math.BigInteger(1, modulusBytes);
            java.math.BigInteger exponent = new java.math.BigInteger(1, exponentBytes);

            RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent);
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(spec);

            publicKeyRef.set(publicKey);
            log.info("JWKS public key loaded successfully from {}", jwksUrl);
        } catch (Exception ex) {
            log.error("Failed to fetch JWKS from {}: {}", jwksUrl, ex.getMessage());
            throw new IllegalStateException("Failed to initialize JWKS cache", ex);
        }
    }

    public PublicKey getPublicKey() {
        PublicKey key = publicKeyRef.get();
        if (key == null) {
            throw new IllegalStateException("JWKS public key not loaded");
        }
        return key;
    }

    public void refresh() {
        log.info("Refreshing JWKS public key...");
        fetchAndCache();
    }
}
