package com.iuh.fit.domain.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StockRestoreFailedEvent {
    private List<StockItem> items;
    private String reason;
    private Instant timestamp;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StockItem {
        private String variantId;
        private int quantity;
    }
}
