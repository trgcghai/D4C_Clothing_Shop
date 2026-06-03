package iuh.fit.CartService.listener;

import iuh.fit.CartService.repository.CartItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Component
public class ProductUpdateListener {

    private static final Logger log = LoggerFactory.getLogger(ProductUpdateListener.class);
    private static final String CART_CACHE_PREFIX = "cart:";

    private final CartItemRepository cartItemRepository;
    private final RedisTemplate<String, String> redisTemplate;

    public ProductUpdateListener(CartItemRepository cartItemRepository,
                                  RedisTemplate<String, String> redisTemplate) {
        this.cartItemRepository = cartItemRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    @RabbitListener(queues = "${cart.rabbitmq.product-sync-queue:cart.product.sync.queue}")
    @SuppressWarnings("unchecked")
    public void handleProductUpdate(Map<String, Object> message) {
        try {
            Map<String, Object> data = (Map<String, Object>) message.get("data");
            if (data == null) {
                log.warn("Received product update event with no data");
                return;
            }

            String productId = (String) data.get("id");
            if (productId == null) {
                log.warn("Received product update event with no product id");
                return;
            }

            int updatedCount = cartItemRepository.markNeedsSyncByProductId(productId);
            if (updatedCount == 0) {
                log.debug("No cart items affected by product update: {}", productId);
                return;
            }

            log.info("Marked {} cart items as needsSync for product {}", updatedCount, productId);

            List<Long> affectedUserIds = cartItemRepository.findDistinctUserIdsByProductId(productId);
            if (!affectedUserIds.isEmpty()) {
                evictCaches(affectedUserIds);
                log.info("Evicted Redis cache for {} users affected by product {}", affectedUserIds.size(), productId);
            }
        } catch (Exception e) {
            log.error("Error processing product update event: {}", e.getMessage(), e);
        }
    }

    private void evictCaches(List<Long> userIds) {
        try {
            String[] keys = userIds.stream()
                    .map(id -> CART_CACHE_PREFIX + id)
                    .toArray(String[]::new);
            redisTemplate.delete(List.of(keys));
        } catch (Exception e) {
            log.error("Failed to evict caches: {}", e.getMessage());
        }
    }
}
