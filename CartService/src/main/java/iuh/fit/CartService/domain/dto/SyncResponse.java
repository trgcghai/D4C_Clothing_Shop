package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncResponse {
    private List<SyncedItem> synced;
    private List<SyncError> errors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyncedItem {
        private String variantId;
        private String productName;
        private BigDecimal price;
        private Integer quantity;
        private Boolean needsSync;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyncError {
        private String variantId;
        private String reason;
        private String message;
    }
}
