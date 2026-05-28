package iuh.fit.CartService.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleServiceUnavailableException_returns503WithMessage() {
        var ex = new ServiceUnavailableException("Test error message");
        var response = handler.handleServiceUnavailableException(ex);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), response.getBody().get("status"));
        assertEquals("Test error message", response.getBody().get("message"));
        assertNotNull(response.getBody().get("timestamp"));
    }
}
