package com.iuh.fit.client;

import com.iuh.fit.client.dto.BatchStockRequest;
import com.iuh.fit.client.dto.BatchStockResponse;
import com.iuh.fit.client.dto.DeductStockRequest;
import com.iuh.fit.client.dto.RestoreStockRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;

@FeignClient(name = "ProductService")
public interface ProductClient {

    @PostMapping("/api/products/variants/{variantId}/deduct-stock")
    void deductStock(
        @PathVariable("variantId") String variantId,
        @RequestBody DeductStockRequest request
    );

    @PostMapping("/api/products/variants/{variantId}/restore-stock")
    void restoreStock(
        @PathVariable("variantId") String variantId,
        @RequestBody RestoreStockRequest request
    );

    @PostMapping("/api/products/stock/deduct-batch")
    BatchStockResponse batchDeductStock(
            @RequestBody List<BatchStockRequest> items,
            @RequestHeader("X-Idempotency-Key") String idempotencyKey);

    @PostMapping("/api/products/stock/restore-batch")
    BatchStockResponse batchRestoreStock(
            @RequestBody List<BatchStockRequest> items,
            @RequestHeader("X-Idempotency-Key") String idempotencyKey);
}
