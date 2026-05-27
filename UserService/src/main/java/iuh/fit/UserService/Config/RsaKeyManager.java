package iuh.fit.UserService.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Component
public class RsaKeyManager {

    @Value("${jwt.private-key-file:config/rsa-private.pem}")
    private String privateKeyFile;

    @Value("${jwt.public-key-file:config/rsa-public.pem}")
    private String publicKeyFile;

    @Value("${jwt.private-key:}")
    private String privateKeyEnv;

    @Value("${jwt.public-key:}")
    private String publicKeyEnv;

    private PrivateKey privateKey;
    private PublicKey publicKey;

    @PostConstruct
    public void init() {
        try {
            if (!privateKeyEnv.isBlank() && !publicKeyEnv.isBlank()) {
                loadFromEnv();
            } else if (Files.exists(Path.of(privateKeyFile)) && Files.exists(Path.of(publicKeyFile))) {
                loadFromFiles();
            } else {
                generateAndPersist();
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize RSA key pair: " + e.getMessage(), e);
        }
    }

    private void loadFromEnv() throws Exception {
        privateKey = parsePrivateKey(privateKeyEnv);
        publicKey = parsePublicKey(publicKeyEnv);
    }

    private void loadFromFiles() throws Exception {
        String privPem = Files.readString(Path.of(privateKeyFile));
        String pubPem = Files.readString(Path.of(publicKeyFile));
        privateKey = parsePrivateKey(privPem);
        publicKey = parsePublicKey(pubPem);
    }

    private void generateAndPersist() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair keyPair = keyGen.generateKeyPair();
        privateKey = keyPair.getPrivate();
        publicKey = keyPair.getPublic();

        Path privPath = Path.of(privateKeyFile);
        Path pubPath = Path.of(publicKeyFile);

        Files.createDirectories(privPath.getParent());
        Files.createDirectories(pubPath.getParent());

        String privPem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(privateKey.getEncoded())
                + "\n-----END PRIVATE KEY-----";

        String pubPem = "-----BEGIN PUBLIC KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(publicKey.getEncoded())
                + "\n-----END PUBLIC KEY-----";

        Files.writeString(privPath, privPem);
        Files.writeString(pubPath, pubPem);
    }

    private PrivateKey parsePrivateKey(String pem) throws Exception {
        String cleaned = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(cleaned);
        return KeyFactory.getInstance("RSA")
                .generatePrivate(new PKCS8EncodedKeySpec(decoded));
    }

    private PublicKey parsePublicKey(String pem) throws Exception {
        String cleaned = pem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(cleaned);
        return KeyFactory.getInstance("RSA")
                .generatePublic(new X509EncodedKeySpec(decoded));
    }

    public PrivateKey getPrivateKey() {
        return privateKey;
    }

    public PublicKey getPublicKey() {
        return publicKey;
    }
}
