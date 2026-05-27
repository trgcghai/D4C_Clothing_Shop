package iuh.fit.UserService.Config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.UserService.Exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(JwksController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class JwksControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RsaKeyManager rsaKeyManager;

    @MockBean
    private JwtUtils jwtUtils;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void test_jwksEndpointReturnsValidJwks() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        RSAPublicKey testPublicKey = (RSAPublicKey) keyGen.generateKeyPair().getPublic();

        when(rsaKeyManager.getPublicKey()).thenReturn(testPublicKey);

        MvcResult result = mockMvc.perform(get("/.well-known/jwks.json"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(responseBody);

        assertTrue(json.has("keys"));
        JsonNode keysArray = json.get("keys");
        assertTrue(keysArray.isArray());
        assertEquals(1, keysArray.size());

        JsonNode key = keysArray.get(0);
        assertTrue(key.has("kty"));
        assertTrue(key.has("kid"));
        assertTrue(key.has("alg"));
        assertTrue(key.has("n"));
        assertTrue(key.has("e"));
    }

    @Test
    void jwksResponseContainsKeyId() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        RSAPublicKey testPublicKey = (RSAPublicKey) keyGen.generateKeyPair().getPublic();

        when(rsaKeyManager.getPublicKey()).thenReturn(testPublicKey);

        MvcResult result = mockMvc.perform(get("/.well-known/jwks.json"))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(responseBody);

        JsonNode key = json.get("keys").get(0);
        // kid is dynamically computed from the key's thumbprint
        assertNotNull(key.get("kid"));
        assertFalse(key.get("kid").asText().isEmpty());
    }

    @Test
    void test_jwksResponseContainsRS256Algorithm() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        RSAPublicKey testPublicKey = (RSAPublicKey) keyGen.generateKeyPair().getPublic();

        when(rsaKeyManager.getPublicKey()).thenReturn(testPublicKey);

        MvcResult result = mockMvc.perform(get("/.well-known/jwks.json"))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(responseBody);

        JsonNode key = json.get("keys").get(0);
        assertEquals("RS256", key.get("alg").asText());
    }
}
