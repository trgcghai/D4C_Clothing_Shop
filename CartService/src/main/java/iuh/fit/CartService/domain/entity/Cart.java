package iuh.fit.CartService.domain.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "carts")
public class Cart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", unique = true, nullable = false)
    private Long userId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Cart() {}

    public Cart(Long id, Long userId, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.userId = userId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static CartBuilder builder() {
        return new CartBuilder();
    }

    public static class CartBuilder {
        private Long id;
        private Long userId;
        private Instant createdAt;
        private Instant updatedAt;

        CartBuilder() {}

        public CartBuilder id(Long id) { this.id = id; return this; }
        public CartBuilder userId(Long userId) { this.userId = userId; return this; }
        public CartBuilder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }
        public CartBuilder updatedAt(Instant updatedAt) { this.updatedAt = updatedAt; return this; }
        public Cart build() { return new Cart(id, userId, createdAt, updatedAt); }
    }
}
