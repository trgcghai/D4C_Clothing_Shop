package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VariantDto {
    private String id;
    private String productId;
    private String color;
    private String size;
    private Integer quantity;
    private String sku;
}
