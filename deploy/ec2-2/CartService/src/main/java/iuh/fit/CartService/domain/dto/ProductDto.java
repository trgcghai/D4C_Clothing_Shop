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
public class ProductDto {
    private String id;
    private String name;
    private String description;
    private BigDecimal price;
    private String categoryId;
    private String gender;
    private String brand;
    private List<String> tags;
    private boolean isFeatured;
    private String imageUrl;
    private String status;
    private List<VariantDto> variants;
}
