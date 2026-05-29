package iuh.fit.CartService.client;

import iuh.fit.CartService.domain.dto.DeductStockRequest;
import iuh.fit.CartService.domain.dto.ProductDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ProductService")
public interface ProductServiceClient {

    @GetMapping("/api/products/{id}")
    ProductDto getProductById(@PathVariable("id") String id);

    @PostMapping("/api/products/variants/{variantId}/deduct-stock")
    void deductStock(@PathVariable("variantId") String variantId, @RequestBody DeductStockRequest request);
}
