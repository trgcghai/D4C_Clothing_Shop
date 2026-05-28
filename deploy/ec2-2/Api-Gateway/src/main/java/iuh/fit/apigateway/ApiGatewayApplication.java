package iuh.fit.apigateway;

import iuh.fit.apigateway.config.JwksCache;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }

    @Bean
    CommandLineRunner initJwks(JwksCache jwksCache) {
        return args -> jwksCache.fetchAndCache();
    }

}
