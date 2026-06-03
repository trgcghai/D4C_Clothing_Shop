package iuh.fit.CartService.listener;

import iuh.fit.CartService.repository.CartItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
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

    @RabbitListener(queues = "${cart.rabbitmq.product-sync-queue:cart.product.sync.queue}")
    public void handleProductUpdate(Map<String, Object> message) {
        try {
            @SuppressWarnings("unchecked")
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

            cartItemRepository.markNeedsSyncByProductId(productId);

            List<Long> affectedUserIds = cartItemRepository.findDistinctUserIdsByProductId(productId);
            if (!affectedUserIds.isEmpty()) {
                evictCaches(affectedUserIds);
                log.info("Evicted Redis cache for {} users affected by product {}", affectedUserIds.size(), productId);
            }
        } catch (Exception e) {
            log.error("Error processing product update event: {}", e.getMessage(), e);
            throw e;
        }
    }

    private void evictCaches(List<Long> userIds) {
        try {
            List<String> keys = userIds.stream()
                    .map(id -> CART_CACHE_PREFIX + id)
                    .toList();
            redisTemplate.delete(keys);
        } catch (Exception e) {
            log.warn("Failed to evict caches: {}", e.getMessage(), e);
        }
    }
}
