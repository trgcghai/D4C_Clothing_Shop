package iuh.fit.CartService.repository;

import iuh.fit.CartService.domain.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByCartId(Long cartId);
    Optional<CartItem> findByCartIdAndVariantId(Long cartId, String variantId);
    void deleteByCartId(Long cartId);
    void deleteByIdAndCartId(Long itemId, Long cartId);
    List<CartItem> findAllByIdInAndCartId(List<Long> itemIds, Long cartId);
    void deleteAllByIdInAndCartId(List<Long> itemIds, Long cartId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE CartItem ci SET ci.needsSync = true WHERE ci.productId = :productId")
    int markNeedsSyncByProductId(@Param("productId") String productId);

    @Query("SELECT DISTINCT ci.cart.userId FROM CartItem ci WHERE ci.productId = :productId AND ci.needsSync = true")
    List<Long> findDistinctUserIdsByProductId(@Param("productId") String productId);

    @Query("SELECT ci FROM CartItem ci WHERE ci.cart.userId = :userId AND ci.needsSync = true")
    List<CartItem> findNeedsSyncByUserId(@Param("userId") Long userId);

    @Query("SELECT ci FROM CartItem ci WHERE ci.cart.userId = :userId AND ci.variantId IN :variantIds")
    List<CartItem> findByUserIdAndVariantIds(@Param("userId") Long userId, @Param("variantIds") List<String> variantIds);
}
