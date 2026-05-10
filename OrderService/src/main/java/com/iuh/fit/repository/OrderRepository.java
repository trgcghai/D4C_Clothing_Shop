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
}
