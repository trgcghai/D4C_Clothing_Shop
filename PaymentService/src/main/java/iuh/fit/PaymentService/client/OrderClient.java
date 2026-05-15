package iuh.fit.PaymentService.client;

import iuh.fit.PaymentService.client.dto.UpdateOrderStatusRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import org.springframework.web.bind.annotation.RequestMapping;

@FeignClient(name = "ORDERSERVICE")
@RequestMapping("/api/public/orders")
public interface OrderClient {

    @PostMapping("/{orderId}/status")
    void updateOrderStatus(
        @PathVariable("orderId") Long orderId,
        @RequestBody UpdateOrderStatusRequest request
    );

    @GetMapping("/{orderId}/owner")
    Long getOrderUserId(@PathVariable("orderId") Long orderId);
}
