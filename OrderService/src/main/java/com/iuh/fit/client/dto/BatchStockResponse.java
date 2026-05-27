package com.iuh.fit.client.dto;

import java.util.List;

public record BatchStockResponse(
    boolean success,
    List<FailedItem> failedItems
) {
    public record FailedItem(String variantId, String reason) {}
}
