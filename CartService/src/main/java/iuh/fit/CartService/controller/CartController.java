package iuh.fit.CartService.controller;

import iuh.fit.CartService.domain.dto.*;
import iuh.fit.CartService.service.CartService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@Tag(name = "Cart", description = "Shopping cart management APIs")
@SecurityRequirement(name = "bearerAuth")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    @Operation(summary = "View cart summary", description = "Get current user's cart with items, variant info, prices, and totals")
    public ResponseEntity<CartResponse> getCart(Authentication authentication) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(cartService.getCart(userId));
    }

    @PostMapping("/items")
    @Operation(summary = "Add item to cart", description = "Add a product variant to cart. If exists, increases quantity. Validates stock from ProductService.")
    public ResponseEntity<CartResponse> addItem(
            Authentication authentication,
            @Valid @RequestBody AddCartItemRequest request) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(cartService.addItem(userId, request));
    }

    @PutMapping("/items/{itemId}")
    @Operation(summary = "Update cart item quantity", description = "Update quantity of a cart item. Quantity = 0 removes the item.")
    public ResponseEntity<CartResponse> updateItemQuantity(
            Authentication authentication,
            @PathVariable Long itemId,
            @Valid @RequestBody UpdateCartItemRequest request) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(cartService.updateItemQuantity(userId, itemId, request));
    }

    @DeleteMapping("/items/{itemId}")
    @Operation(summary = "Remove item from cart", description = "Remove an item from cart. Ignores if item doesn't exist.")
    public ResponseEntity<CartResponse> removeItem(
            Authentication authentication,
            @PathVariable Long itemId) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(cartService.removeItem(userId, itemId));
    }

    @DeleteMapping
    @Operation(summary = "Clear cart", description = "Remove all items from cart. Idempotent.")
    public ResponseEntity<Void> clearCart(Authentication authentication) {
        Long userId = extractUserId(authentication);
        cartService.clearCart(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/validate")
    @Operation(summary = "Validate cart before checkout", description = "Check all items against ProductService for stock, price changes, and active status.")
    public ResponseEntity<ValidationResponse> validateCart(Authentication authentication) {
        Long userId = extractUserId(authentication);
        ValidationResponse response = cartService.validateCart(userId);
        HttpStatus status = response.isValid() ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(response);
    }

    @PostMapping("/checkout")
    @Operation(summary = "Checkout - create order draft", description = "Create order with PENDING status. Snapshots price, product name, variant info. Cart is NOT cleared immediately.")
    public ResponseEntity<CheckoutResponse> checkout(Authentication authentication) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cartService.checkout(userId));
    }

    private Long extractUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
