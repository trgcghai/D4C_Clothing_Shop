package com.iuh.fit.client;

import com.iuh.fit.client.dto.RestoreStockRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

@FeignClient(name = "ProductService")
@RequestMapping("/api/products/variants")
public interface ProductClient {

    @PostMapping("/{variantId}/restore-stock")
    void restoreStock(
        @PathVariable("variantId") String variantId,
        @RequestBody RestoreStockRequest request
    );
}
