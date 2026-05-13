package iuh.fit.CartService.service;

import iuh.fit.CartService.client.ProductServiceClient;
import iuh.fit.CartService.domain.dto.*;
import iuh.fit.CartService.domain.entity.Cart;
import iuh.fit.CartService.domain.entity.CartItem;
import iuh.fit.CartService.repository.CartItemRepository;
import iuh.fit.CartService.repository.CartRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class CartService {

    private static final Logger log = LoggerFactory.getLogger(CartService.class);
    private static final String CART_CACHE_PREFIX = "cart:";
    private static final long CACHE_TTL_MINUTES = 30;

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductServiceClient productServiceClient;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public CartService(CartRepository cartRepository,
                       CartItemRepository cartItemRepository,
                       ProductServiceClient productServiceClient,
                       RedisTemplate<String, String> redisTemplate,
                       ObjectMapper objectMapper) {
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.productServiceClient = productServiceClient;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public CartResponse getCart(Long userId) {
        String cacheKey = CART_CACHE_PREFIX + userId;
        String cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            CartResponse cachedResponse = deserializeCartResponse(cached);
            if (cachedResponse != null) {
                log.debug("Cache hit for cart of user {}", userId);
                return cachedResponse;
            }
        }

        Cart cart = cartRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Cart newCart = Cart.builder().userId(userId).build();
                    return cartRepository.save(newCart);
                });

        CartResponse response = buildCartResponse(cart);
        cacheCartResponse(cacheKey, response);
        return response;
    }

    @Transactional
    public CartResponse addItem(Long userId, AddCartItemRequest request) {
        ProductDto product;
        try {
            product = productServiceClient.getProductById(request.getProductId());
        } catch (Exception e) {
            throw new RuntimeException("Cannot fetch product info from ProductService");
        }

        if (product == null) {
            throw new RuntimeException("Product not found");
        }

        if ("INACTIVE".equalsIgnoreCase(product.getStatus())) {
            throw new RuntimeException("Product '" + product.getName() + "' is inactive");
        }

        VariantDto variant = product.getVariants().stream()
                .filter(v -> v.getId().equals(request.getVariantId()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Variant not found"));

        if (variant.getQuantity() < request.getQuantity()) {
            throw new RuntimeException("Insufficient stock for variant " + variant.getId());
        }

        Cart cart = cartRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Cart newCart = Cart.builder().userId(userId).build();
                    return cartRepository.save(newCart);
                });

        CartItem existingItem = cartItemRepository
                .findByCartIdAndVariantId(cart.getId(), request.getVariantId())
                .orElse(null);

        if (existingItem != null) {
            int newQuantity = existingItem.getQuantity() + request.getQuantity();
            if (newQuantity > variant.getQuantity()) {
                throw new RuntimeException("Total quantity exceeds available stock");
            }
            existingItem.setQuantity(newQuantity);
            cartItemRepository.save(existingItem);
        } else {
            CartItem newItem = CartItem.builder()
                    .cart(cart)
                    .variantId(variant.getId())
                    .productId(product.getId())
                    .productName(product.getName())
                    .color(variant.getColor())
                    .size(variant.getSize())
                    .price(product.getPrice())
                    .quantity(request.getQuantity())
                    .sku(variant.getSku())
                    .imageUrl(product.getImageUrl())
                    .build();
            cartItemRepository.save(newItem);
        }

        CartResponse response = buildCartResponse(cart);
        invalidateCache(userId);
        return response;
    }

    @Transactional
    public CartResponse updateItemQuantity(Long userId, Long itemId, UpdateCartItemRequest request) {
        Cart cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Cart not found"));

        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Cart item not found"));

        if (!item.getCart().getId().equals(cart.getId())) {
            throw new RuntimeException("Cart item does not belong to this cart");
        }

        if (request.getQuantity() == 0) {
            cartItemRepository.delete(item);
            CartResponse response = buildCartResponse(cart);
            invalidateCache(userId);
            return response;
        }

        ProductDto product;
        try {
            product = productServiceClient.getProductById(item.getProductId());
        } catch (Exception e) {
            throw new RuntimeException("Cannot fetch product info from ProductService");
        }

        VariantDto variant = product.getVariants().stream()
                .filter(v -> v.getId().equals(item.getVariantId()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Variant not found"));

        if (request.getQuantity() > variant.getQuantity()) {
            throw new RuntimeException("Requested quantity exceeds available stock");
        }

        item.setQuantity(request.getQuantity());
        cartItemRepository.save(item);

        CartResponse response = buildCartResponse(cart);
        invalidateCache(userId);
        return response;
    }

    @Transactional
    public CartResponse removeItem(Long userId, Long itemId) {
        Cart cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Cart not found"));

        cartItemRepository.deleteByIdAndCartId(itemId, cart.getId());

        CartResponse response = buildCartResponse(cart);
        invalidateCache(userId);
        return response;
    }

    @Transactional
    public void clearCart(Long userId) {
        Cart cart = cartRepository.findByUserId(userId)
                .orElse(null);
        if (cart != null) {
            cartItemRepository.deleteByCartId(cart.getId());
            invalidateCache(userId);
        }
    }

    @Transactional
    public void clearCartAfterCheckout(Long userId) {
        Cart cart = cartRepository.findByUserId(userId)
                .orElse(null);
        if (cart != null) {
            List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
            if (!items.isEmpty()) {
                cartItemRepository.deleteByCartId(cart.getId());
                invalidateCache(userId);
                log.info("Cart cleared after checkout for user {}", userId);
            } else {
                log.info("Cart already empty for user {}, skip clear", userId);
            }
        } else {
            log.info("No cart found for user {}, skip clear (idempotent)", userId);
        }
    }

    public ValidationResponse validateCart(Long userId) {
        Cart cart = cartRepository.findByUserId(userId)
                .orElse(null);
        if (cart == null) {
            return ValidationResponse.builder()
                    .valid(true)
                    .errors(List.of())
                    .build();
        }

        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        List<ValidationResponse.ValidationError> errors = new ArrayList<>();

        for (CartItem item : items) {
            try {
                ProductDto product = productServiceClient.getProductById(item.getProductId());
                VariantDto variant = product.getVariants().stream()
                        .filter(v -> v.getId().equals(item.getVariantId()))
                        .findFirst()
                        .orElse(null);

                if (variant == null) {
                    errors.add(ValidationResponse.ValidationError.builder()
                            .variantId(item.getVariantId())
                            .reason("VARIANT_NOT_FOUND")
                            .message("Variant '" + item.getVariantId() + "' không tồn tại")
                            .build());
                    continue;
                }

                if ("INACTIVE".equalsIgnoreCase(product.getStatus())) {
                    errors.add(ValidationResponse.ValidationError.builder()
                            .variantId(item.getVariantId())
                            .reason("PRODUCT_INACTIVE")
                            .message("Product '" + product.getName() + "' không còn hoạt động")
                            .build());
                    continue;
                }

                if (variant.getQuantity() < item.getQuantity()) {
                    errors.add(ValidationResponse.ValidationError.builder()
                            .variantId(item.getVariantId())
                            .reason("OUT_OF_STOCK")
                            .message("Variant '" + variant.getColor() + "/" + variant.getSize()
                                    + "' không đủ hàng (cần: " + item.getQuantity()
                                    + ", có: " + variant.getQuantity() + ")")
                            .build());
                }

                if (product.getPrice().compareTo(item.getPrice()) != 0) {
                    errors.add(ValidationResponse.ValidationError.builder()
                            .variantId(item.getVariantId())
                            .reason("PRICE_CHANGED")
                            .message("Giá đã thay đổi từ " + item.getPrice()
                                    + " → " + product.getPrice())
                            .build());
                }
            } catch (Exception e) {
                errors.add(ValidationResponse.ValidationError.builder()
                        .variantId(item.getVariantId())
                        .reason("PRODUCT_UNAVAILABLE")
                        .message("Không thể lấy thông tin product từ ProductService")
                        .build());
            }
        }

        return ValidationResponse.builder()
                .valid(errors.isEmpty())
                .errors(errors)
                .build();
    }

    @Transactional
    public CheckoutResponse checkout(Long userId) {
        Cart cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Cart not found"));

        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        if (items.isEmpty()) {
            throw new RuntimeException("Cart is empty");
        }

        List<String> validationErrors = new ArrayList<>();
        for (CartItem item : items) {
            try {
                ProductDto product = productServiceClient.getProductById(item.getProductId());
                if (product == null) {
                    validationErrors.add("Sản phẩm '" + item.getProductName() + "' không tồn tại");
                    continue;
                }
                if ("INACTIVE".equalsIgnoreCase(product.getStatus())) {
                    validationErrors.add("Sản phẩm '" + product.getName() + "' không còn hoạt động");
                    continue;
                }
                VariantDto variant = product.getVariants().stream()
                        .filter(v -> v.getId().equals(item.getVariantId()))
                        .findFirst()
                        .orElse(null);
                if (variant == null) {
                    validationErrors.add("Variant '" + item.getVariantId() + "' không tồn tại");
                    continue;
                }
                if (variant.getQuantity() < item.getQuantity()) {
                    validationErrors.add("Sản phẩm '" + item.getProductName()
                            + "' (" + item.getColor() + ", " + item.getSize()
                            + ") chỉ còn " + variant.getQuantity()
                            + ", bạn cần " + item.getQuantity());
                }
            } catch (Exception e) {
                validationErrors.add("Không thể kiểm tra tồn kho sản phẩm '" + item.getProductName() + "'");
            }
        }

        if (!validationErrors.isEmpty()) {
            throw new RuntimeException("Thanh toán thất bại:\n" + String.join("\n", validationErrors));
        }

        String orderId = "ORD-" + System.currentTimeMillis() + "-" + userId;

        List<CheckoutResponse.CheckoutItem> checkoutItems = items.stream()
                .map(item -> CheckoutResponse.CheckoutItem.builder()
                        .variantId(item.getVariantId())
                        .productId(item.getProductId())
                        .productName(item.getProductName())
                        .color(item.getColor())
                        .size(item.getSize())
                        .price(item.getPrice())
                        .quantity(item.getQuantity())
                        .snapshot(CheckoutResponse.Snapshot.builder()
                                .priceAtCheckout(item.getPrice())
                                .productName(item.getProductName())
                                .variantSku(item.getSku())
                                .build())
                        .build())
                .collect(Collectors.toList());

        BigDecimal totalAmount = checkoutItems.stream()
                .map(i -> i.getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return CheckoutResponse.builder()
                .orderId(orderId)
                .status("PENDING")
                .items(checkoutItems)
                .totalAmount(totalAmount)
                .build();
    }

    private CartResponse buildCartResponse(Cart cart) {
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());

        List<CartResponse.CartItemDto> itemDtos = items.stream()
                .map(item -> CartResponse.CartItemDto.builder()
                        .id(item.getId())
                        .variantId(item.getVariantId())
                        .productId(item.getProductId())
                        .productName(item.getProductName())
                        .color(item.getColor())
                        .size(item.getSize())
                        .price(item.getPrice())
                        .quantity(item.getQuantity())
                        .subtotal(item.getSubtotal())
                        .sku(item.getSku())
                        .imageUrl(item.getImageUrl())
                        .build())
                .collect(Collectors.toList());

        BigDecimal totalAmount = itemDtos.stream()
                .map(CartResponse.CartItemDto::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int totalItems = itemDtos.stream()
                .mapToInt(CartResponse.CartItemDto::getQuantity)
                .sum();

        return CartResponse.builder()
                .cartId(cart.getId())
                .userId(cart.getUserId())
                .items(itemDtos)
                .totalAmount(totalAmount)
                .totalItems(totalItems)
                .build();
    }

    private void cacheCartResponse(String cacheKey, CartResponse response) {
        try {
            String json = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize cart for caching: {}", e.getMessage());
        } catch (Exception e) {
            log.warn("Failed to cache cart for user {}: {}", cacheKey, e.getMessage());
        }
    }

    private void invalidateCache(Long userId) {
        try {
            redisTemplate.delete(CART_CACHE_PREFIX + userId);
        } catch (Exception e) {
            log.warn("Failed to invalidate cache for user {}: {}", userId, e.getMessage());
        }
    }

    private CartResponse deserializeCartResponse(String cached) {
        try {
            return objectMapper.readValue(cached, CartResponse.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to deserialize cached cart: {}", e.getMessage());
            return null;
        }
    }
}
