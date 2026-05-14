package iuh.fit.apigateway;

import iuh.fit.apigateway.config.JwksCache;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.TestPropertySource;

import static org.mockito.Mockito.mock;

@SpringBootTest
@TestPropertySource(properties = {
        "gateway.jwks.url=http://localhost:9999/.well-known/jwks.json"
})
class ApiGatewayApplicationTests {

    @Test
    void contextLoads() {
    }

    @Configuration
    static class TestConfig {
        @Bean
        @Primary
        JwksCache jwksCache() {
            return mock(JwksCache.class);
        }
    }
}
