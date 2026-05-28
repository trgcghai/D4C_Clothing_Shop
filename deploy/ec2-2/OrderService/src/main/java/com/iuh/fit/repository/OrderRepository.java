package com.iuh.fit.repository;

import com.iuh.fit.domain.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = {"items"})
    Optional<Order> findByUserIdAndCheckoutOrderId(Long userId, String checkoutOrderId);

    @EntityGraph(attributePaths = {"items"})
    Optional<Order> findByIdAndUserId(Long id, Long userId);

    @EntityGraph(attributePaths = {"items"})
    List<Order> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"items"})
    Page<Order> findAllByUserId(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = {"items"})
    Page<Order> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"items"})
    Page<Order> findAllByStatus(com.iuh.fit.domain.enums.OrderStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"items"})
    Page<Order> findAllByCreatedAtBetween(java.time.Instant start, java.time.Instant end, Pageable pageable);

    @EntityGraph(attributePaths = {"items"})
    Page<Order> findAllByStatusAndCreatedAtBetween(com.iuh.fit.domain.enums.OrderStatus status, java.time.Instant start, java.time.Instant end, Pageable pageable);

    @EntityGraph(attributePaths = {"items"})
    java.util.Optional<Order> findOneById(Long id);
}
