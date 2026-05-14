package iuh.fit.UserService.Config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class RsaKeyManagerTest {

    @TempDir
    Path tempDir;

    @Test
    void test_generateAndPersistKeys() throws Exception {
        Path privateFile = tempDir.resolve("private.pem");
        Path publicFile = tempDir.resolve("public.pem");

        RsaKeyManager manager = new RsaKeyManager();
        ReflectionTestUtils.setField(manager, "privateKeyFile", privateFile.toString());
        ReflectionTestUtils.setField(manager, "publicKeyFile", publicFile.toString());
        ReflectionTestUtils.setField(manager, "privateKeyEnv", "");
        ReflectionTestUtils.setField(manager, "publicKeyEnv", "");

        manager.init();

        assertNotNull(manager.getPrivateKey());
        assertNotNull(manager.getPublicKey());
        assertTrue(Files.exists(privateFile));
        assertTrue(Files.exists(publicFile));
    }

    @Test
    void test_loadKeysFromEnv() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        var keyPair = keyGen.generateKeyPair();

        String privPem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(keyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----";

        String pubPem = "-----BEGIN PUBLIC KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(keyPair.getPublic().getEncoded())
                + "\n-----END PUBLIC KEY-----";

        Path privateFile = tempDir.resolve("private.pem");
        Path publicFile = tempDir.resolve("public.pem");

        RsaKeyManager manager = new RsaKeyManager();
        ReflectionTestUtils.setField(manager, "privateKeyFile", privateFile.toString());
        ReflectionTestUtils.setField(manager, "publicKeyFile", publicFile.toString());
        ReflectionTestUtils.setField(manager, "privateKeyEnv", privPem);
        ReflectionTestUtils.setField(manager, "publicKeyEnv", pubPem);

        manager.init();

        assertNotNull(manager.getPrivateKey());
        assertNotNull(manager.getPublicKey());
        assertEquals(keyPair.getPrivate(), manager.getPrivateKey());
        assertEquals(keyPair.getPublic(), manager.getPublicKey());
        assertFalse(Files.exists(privateFile));
    }

    @Test
    void test_loadKeysFromFiles() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        var keyPair = keyGen.generateKeyPair();

        String privPem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(keyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----";

        String pubPem = "-----BEGIN PUBLIC KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(keyPair.getPublic().getEncoded())
                + "\n-----END PUBLIC KEY-----";

        Path privateFile = tempDir.resolve("private.pem");
        Path publicFile = tempDir.resolve("public.pem");

        Files.writeString(privateFile, privPem);
        Files.writeString(publicFile, pubPem);

        RsaKeyManager manager = new RsaKeyManager();
        ReflectionTestUtils.setField(manager, "privateKeyFile", privateFile.toString());
        ReflectionTestUtils.setField(manager, "publicKeyFile", publicFile.toString());
        ReflectionTestUtils.setField(manager, "privateKeyEnv", "");
        ReflectionTestUtils.setField(manager, "publicKeyEnv", "");

        manager.init();

        assertNotNull(manager.getPrivateKey());
        assertNotNull(manager.getPublicKey());
        assertEquals(keyPair.getPrivate(), manager.getPrivateKey());
        assertEquals(keyPair.getPublic(), manager.getPublicKey());
    }

    @Test
    void test_envTakesPrecedenceOverFiles() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        var envKeyPair = keyGen.generateKeyPair();

        keyGen.initialize(2048);
        var fileKeyPair = keyGen.generateKeyPair();

        String envPrivPem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(envKeyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----";

        String envPubPem = "-----BEGIN PUBLIC KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(envKeyPair.getPublic().getEncoded())
                + "\n-----END PUBLIC KEY-----";

        String filePrivPem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(fileKeyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----";

        String filePubPem = "-----BEGIN PUBLIC KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(fileKeyPair.getPublic().getEncoded())
                + "\n-----END PUBLIC KEY-----";

        Path privateFile = tempDir.resolve("private.pem");
        Path publicFile = tempDir.resolve("public.pem");

        Files.writeString(privateFile, filePrivPem);
        Files.writeString(publicFile, filePubPem);

        RsaKeyManager manager = new RsaKeyManager();
        ReflectionTestUtils.setField(manager, "privateKeyFile", privateFile.toString());
        ReflectionTestUtils.setField(manager, "publicKeyFile", publicFile.toString());
        ReflectionTestUtils.setField(manager, "privateKeyEnv", envPrivPem);
        ReflectionTestUtils.setField(manager, "publicKeyEnv", envPubPem);

        manager.init();

        assertEquals(envKeyPair.getPrivate(), manager.getPrivateKey());
        assertEquals(envKeyPair.getPublic(), manager.getPublicKey());
        assertNotEquals(fileKeyPair.getPrivate(), manager.getPrivateKey());
    }

    @Test
    void test_keysAreValidRsaPair() throws Exception {
        Path privateFile = tempDir.resolve("private.pem");
        Path publicFile = tempDir.resolve("public.pem");

        RsaKeyManager manager = new RsaKeyManager();
        ReflectionTestUtils.setField(manager, "privateKeyFile", privateFile.toString());
        ReflectionTestUtils.setField(manager, "publicKeyFile", publicFile.toString());
        ReflectionTestUtils.setField(manager, "privateKeyEnv", "");
        ReflectionTestUtils.setField(manager, "publicKeyEnv", "");

        manager.init();

        PrivateKey privateKey = manager.getPrivateKey();
        PublicKey publicKey = manager.getPublicKey();

        byte[] data = "test data".getBytes();
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(privateKey);
        signature.update(data);
        byte[] signed = signature.sign();

        Signature verify = Signature.getInstance("SHA256withRSA");
        verify.initVerify(publicKey);
        verify.update(data);

        assertTrue(verify.verify(signed));
    }
}
