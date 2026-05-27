package iuh.fit.PaymentService.service;

import feign.Request;
import feign.RequestTemplate;
import feign.FeignException;
import iuh.fit.PaymentService.PaymentServiceApplication;
import iuh.fit.PaymentService.client.OrderClient;
import iuh.fit.PaymentService.domain.dto.CreatePaymentRequest;
import iuh.fit.PaymentService.domain.dto.PaymentResponse;
import iuh.fit.PaymentService.exception.ServiceUnavailableException;
import iuh.fit.PaymentService.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import iuh.fit.PaymentService.config.SePayConfig;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(classes = PaymentServiceApplication.class)
@TestPropertySource(properties = {
    "eureka.client.enabled=false",
    "spring.datasource.url=jdbc:h2:mem:testdb",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect"
})
class PaymentServiceTest {

    @MockBean
    private PaymentRepository paymentRepository;

    @MockBean
    private OrderClient orderClient;

    @MockBean
    private SePayConfig sePayConfig;

    @Autowired
    private PaymentService paymentService;

    private Request createRequest() {
        Map<String, Collection<String>> headers = new HashMap<>();
        return Request.create(
                Request.HttpMethod.GET,
                "/test",
                headers,
                new byte[0],
                StandardCharsets.UTF_8,
                new RequestTemplate()
        );
    }

    @Test
    void createPayment_whenOrderServiceDown_throwsServiceUnavailable() {
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setOrderId(1L);
        request.setCheckoutOrderId("ORD-123");
        request.setAmount(100000L);

        when(orderClient.getOrderUserId(anyLong()))
                .thenThrow(new FeignException.ServiceUnavailable("OrderService down", createRequest(), new byte[0], new HashMap<>()));

        assertThrows(ServiceUnavailableException.class,
                () -> paymentService.createPayment(request, 1L));
    }

    @Test
    void getPaymentByOrderId_whenOrderServiceDown_throwsServiceUnavailable() {
        when(paymentRepository.findByOrderId(1L))
                .thenReturn(Optional.of(new iuh.fit.PaymentService.domain.entity.Payment()));

        when(orderClient.getOrderUserId(anyLong()))
                .thenThrow(new FeignException.ServiceUnavailable("OrderService down", createRequest(), new byte[0], new HashMap<>()));

        assertThrows(ServiceUnavailableException.class,
                () -> paymentService.getPaymentByOrderId(1L, 1L));
    }

    @Test
    void createPayment_whenOrderServiceHealthy_createsPaymentSuccessfully() {
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setOrderId(1L);
        request.setCheckoutOrderId("ORD-123");
        request.setAmount(100000L);

        when(orderClient.getOrderUserId(1L)).thenReturn(1L);
        when(paymentRepository.findByCheckoutOrderId("ORD-123")).thenReturn(Optional.empty());
        when(sePayConfig.generatePaymentCode()).thenReturn("PAY-001");
        when(paymentRepository.save(any())).thenAnswer(invocation -> {
            var p = invocation.getArgument(0, iuh.fit.PaymentService.domain.entity.Payment.class);
            p.setId(1L);
            p.setCreatedAt(java.time.Instant.now());
            return p;
        });

        PaymentResponse response = paymentService.createPayment(request, 1L);

        assertNotNull(response);
        assertEquals(1L, response.getOrderId());
    }

    @Test
    void getPaymentByOrderId_whenOrderServiceHealthy_returnsPayment() {
        var payment = new iuh.fit.PaymentService.domain.entity.Payment();
        payment.setId(1L);
        payment.setOrderId(1L);

        when(paymentRepository.findByOrderId(1L)).thenReturn(Optional.of(payment));
        when(orderClient.getOrderUserId(1L)).thenReturn(1L);

        PaymentResponse response = paymentService.getPaymentByOrderId(1L, 1L);

        assertNotNull(response);
        assertEquals(1L, response.getOrderId());
    }
}
