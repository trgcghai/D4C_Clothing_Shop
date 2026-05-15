package iuh.fit.UserService.Config;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.KeyUse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.interfaces.RSAPublicKey;
import java.util.List;
import java.util.Map;

@RestController
public class JwksController {

    private final RsaKeyManager rsaKeyManager;

    public JwksController(RsaKeyManager rsaKeyManager) {
        this.rsaKeyManager = rsaKeyManager;
    }

    @GetMapping("/.well-known/jwks.json")
    public Map<String, Object> getJwks() {
        RSAPublicKey publicKey = (RSAPublicKey) rsaKeyManager.getPublicKey();

        RSAKey jwk = new RSAKey.Builder(publicKey)
                .keyID(computeKeyId(publicKey))
                .algorithm(JWSAlgorithm.RS256)
                .keyUse(KeyUse.SIGNATURE)
                .build();

        return Map.of("keys", List.of(jwk.toJSONObject()));
    }

    private String computeKeyId(RSAPublicKey publicKey) {
        try {
            RSAKey jwk = new RSAKey.Builder(publicKey).build();
            return jwk.computeThumbprint().toString();
        } catch (Exception e) {
            return "d4c-key-1";
        }
    }
}
