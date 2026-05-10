package iuh.fit.CartService.repository;

import iuh.fit.CartService.domain.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByCartId(Long cartId);
    Optional<CartItem> findByCartIdAndVariantId(Long cartId, String variantId);
    void deleteByCartId(Long cartId);
    void deleteByIdAndCartId(Long itemId, Long cartId);
}
