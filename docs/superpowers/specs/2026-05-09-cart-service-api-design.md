# CartService API Design

**Date:** 2026-05-09
**Status:** Approved

## Overview

CartService manages user shopping carts for D4C Clothing Shop. It handles adding/removing items, quantity updates, cart validation before checkout, and checkout order draft creation.

## Architecture

- **Framework:** Spring Boot 3.3.1, Java 21
- **Port:** 8084
- **Database:** MariaDB (persistent) + Redis (cache)
- **Service Discovery:** Netflix Eureka
- **API Gateway:** Spring Cloud Gateway routes `/api/cart/**` → `lb://CARTSERVICE`
- **Authentication:** JWT Bearer token (same secret as UserService)
- **Inter-service:** Feign Client → ProductService (stock validation, product info)
- **Documentation:** springdoc-openapi + Swagger UI

## Data Models

### Cart (table: `carts`)
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | BIGINT | PK, AUTO_INCREMENT |
| `user_id` | BIGINT | UNIQUE, NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

### Cart Item (table: `cart_items`)
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | BIGINT | PK, AUTO_INCREMENT |
| `cart_id` | BIGINT | FK → carts.id, NOT NULL |
| `variant_id` | VARCHAR(36) | NOT NULL |
| `product_name` | VARCHAR(255) | NOT NULL (snapshot) |
| `color` | VARCHAR(50) | NOT NULL (snapshot) |
| `size` | VARCHAR(20) | NOT NULL (snapshot) |
| `price` | DECIMAL(10,2) | NOT NULL (snapshot) |
| `quantity` | INT | NOT NULL, CHECK > 0 |
| `sku` | VARCHAR(100) | (snapshot) |

## API Endpoints

All endpoints under `/api/cart`, require Bearer JWT authentication.

### 1. GET /api/cart — View Cart Summary
Returns current user's cart with items, variant info, prices, and totals.
- Auto-creates cart if not exists (returns empty cart)
- Filters out INACTIVE products from ProductService

### 2. POST /api/cart/items — Add Item to Cart
```json
{ "variantId": "uuid", "quantity": 2 }
```
- Validates stock from ProductService
- Rejects if product INACTIVE
- If variant exists in cart → increment quantity (validate total ≤ stock)
- Returns updated cart

### 3. PUT /api/cart/items/{itemId} — Update Cart Item Quantity
```json
{ "quantity": 5 }
```
- quantity = 0 → remove item
- Validates quantity ≤ stock
- Recalculates totals
- Prevents duplicate cart items

### 4. DELETE /api/cart/items/{itemId} — Remove Item from Cart
- Ignores if item doesn't exist
- Returns updated cart
- Does not delete cart itself

### 5. DELETE /api/cart — Clear Cart
- Removes all cart items
- Idempotent
- Cart entity remains (for future use)

### 6. POST /api/cart/validate — Validate Cart Before Checkout
Checks all items against ProductService:
- Stock availability
- Current price (detects price changes)
- Product/variant ACTIVE status
Returns detailed error list per item. Does NOT lock stock.

### 7. POST /api/cart/checkout — Create Order Draft
- Creates order with PENDING status
- Snapshots: price, product name, variant info, SKU
- Order is independent of ProductService after creation
- Cart is NOT cleared immediately (handled separately)
- Returns orderId for payment step

## Redis Caching Strategy

- **Key pattern:** `cart:{userId}`
- **TTL:** 30 minutes
- **Cache on:** GET /api/cart
- **Invalidate on:** All write operations (add, update, remove, clear)
- **Product info cache:** `product:{variantId}`, TTL 5 minutes

## Feign Client — ProductService

Read-only calls to ProductService:
- `GET /api/products/{id}` — get product details + variants
- Used for: stock validation, price check, product status, variant info

## Security

- JWT authentication (same secret as UserService)
- UserId extracted from JWT subject
- Swagger paths publicly accessible
- All `/api/cart/**` paths require authentication

## Docker

- Multi-stage build (Maven → JRE)
- Non-root user
- Health check via `/actuator/health`
- Exposes port 8084
- Environment variables from `.env`

## API Gateway Integration

New route in Api-Gateway:
```
spring.cloud.gateway.routes[x].id=cartservice-route
spring.cloud.gateway.routes[x].uri=lb://CARTSERVICE
spring.cloud.gateway.routes[x].predicates[0]=Path=/api/cart/**
```
