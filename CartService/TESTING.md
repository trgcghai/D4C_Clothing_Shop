# CartService Testing Guide

## Prerequisites

### 1. Infrastructure must be running

```bash
# From project root
docker compose up -d discovery-server mariadb redis
```

Wait for all services to be healthy:
```bash
docker compose ps
```

### 2. Start CartService

```bash
cd CartService
.\mvnw.cmd spring-boot:run
```

Or via Docker:
```bash
docker compose up -d cartservice
```

### 3. Generate a valid JWT token

CartService uses the **same JWT secret** as UserService. The JWT subject must be a **numeric user ID** (e.g., `"1"`, `"5"`).

**Option A: Get token from UserService** (if UserService is running)
```bash
# Sign in to get a real token
curl -X POST http://localhost:8080/api/auth/signin ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"your_username\",\"password\":\"your_password\"}"
```
Extract the `token` field from the response.

**Option B: Generate a test JWT manually**

The JWT secret in `.env` is `ReplaceWithStrongJwtSecretValueAtLeast32Bytes`. Use an online JWT generator or this Node.js one-liner:

```bash
node -e "
const crypto = require('crypto');
const secret = 'ReplaceWithStrongJwtSecretValueAtLeast32Bytes';
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({sub:'1',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400})).toString('base64url');
const sig = crypto.createHmac('sha256', secret).update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
"
```

Save the token as an environment variable:
```powershell
$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Test Scenarios

All requests go through API Gateway at `http://localhost:8080` or directly to CartService at `http://localhost:8084`.

### Test 1: Swagger UI is accessible

```
http://localhost:8084/swagger-ui/index.html
```
Expected: Swagger UI loads without authentication.

### Test 2: View empty cart (auto-creates cart)

```bash
curl -X GET http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected response (200 OK):
```json
{
  "cartId": 1,
  "userId": 1,
  "items": [],
  "totalAmount": 0.00,
  "totalItems": 0
}
```

### Test 3: Add item to cart

You need a valid **variant ID** from ProductService. First, get one:

```bash
# Get a product with variants
curl http://localhost:8080/api/products/1
```

Copy a variant `id` from the response (e.g., `"abc-123-def"`).

```bash
curl -X POST http://localhost:8084/api/cart/items ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"variantId\":\"YOUR_VARIANT_ID\",\"quantity\":2}"
```

Expected response (200 OK):
```json
{
  "cartId": 1,
  "userId": 1,
  "items": [
    {
      "id": 1,
      "variantId": "YOUR_VARIANT_ID",
      "productName": "Áo thun D4C",
      "color": "Black",
      "size": "L",
      "price": 250000.00,
      "quantity": 2,
      "subtotal": 500000.00,
      "sku": "ABC-123"
    }
  ],
  "totalAmount": 500000.00,
  "totalItems": 2
}
```

### Test 4: Add same variant again (should increment quantity)

```bash
curl -X POST http://localhost:8084/api/cart/items ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"variantId\":\"YOUR_VARIANT_ID\",\"quantity\":1}"
```

Expected: Same item, quantity becomes 3, subtotal recalculated.

### Test 5: Add item with invalid variant ID

```bash
curl -X POST http://localhost:8084/api/cart/items ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"variantId\":\"nonexistent-id\",\"quantity\":1}"
```

Expected: 400 Bad Request with message about product/variant not found.

### Test 6: Validation error - missing fields

```bash
curl -X POST http://localhost:8084/api/cart/items ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"variantId\":\"\",\"quantity\":0}"
```

Expected: 400 Bad Request with validation errors:
```json
{
  "timestamp": "...",
  "status": 400,
  "message": "Validation failed",
  "errors": {
    "variantId": "Variant ID is required",
    "quantity": "Quantity must be at least 1"
  }
}
```

### Test 7: Update cart item quantity

Get the `itemId` from Test 3/4 response (e.g., `1`).

```bash
curl -X PUT http://localhost:8084/api/cart/items/1 ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"quantity\":5}"
```

Expected: 200 OK, quantity updated to 5, subtotal recalculated.

### Test 8: Remove item by setting quantity to 0

```bash
curl -X PUT http://localhost:8084/api/cart/items/1 ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"quantity\":0}"
```

Expected: 200 OK, item removed from cart, items array empty or reduced.

### Test 9: Remove item via DELETE

First add an item, then:

```bash
curl -X DELETE http://localhost:8084/api/cart/items/1 ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: 200 OK, item removed.

### Test 10: Delete non-existent item (should ignore)

```bash
curl -X DELETE http://localhost:8084/api/cart/items/99999 ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: 200 OK, cart unchanged (no error).

### Test 11: Clear entire cart

Add some items first, then:

```bash
curl -X DELETE http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: 204 No Content (empty body).

Verify cart is empty:
```bash
curl -X GET http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"
```
Expected: `items: []`, `totalAmount: 0`, `totalItems: 0`.

### Test 12: Clear empty cart (idempotent)

```bash
curl -X DELETE http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: 204 No Content (no error).

### Test 13: Validate cart before checkout

Add valid items first, then:

```bash
curl -X POST http://localhost:8084/api/cart/validate ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected (if all items valid):
```json
{
  "valid": true,
  "errors": []
}
```

### Test 14: Validate cart with invalid items

If ProductService is down or items have changed price/stock:

```bash
curl -X POST http://localhost:8084/api/cart/validate ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected (if issues found):
```json
{
  "valid": false,
  "errors": [
    {
      "variantId": "...",
      "reason": "OUT_OF_STOCK",
      "message": "Variant 'Black/L' không đủ hàng (cần: 5, có: 2)"
    }
  ]
}
```

HTTP status should be 400.

### Test 15: Checkout - create order draft

Add items first, then:

```bash
curl -X POST http://localhost:8084/api/cart/checkout ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected (201 Created):
```json
{
  "orderId": "ORD-1715000000000-1",
  "status": "PENDING",
  "items": [
    {
      "productName": "Áo thun D4C",
      "color": "Black",
      "size": "L",
      "price": 250000.00,
      "quantity": 2,
      "snapshot": {
        "priceAtCheckout": 250000.00,
        "productName": "Áo thun D4C",
        "variantSku": "ABC-123"
      }
    }
  ],
  "totalAmount": 500000.00
}
```

### Test 16: Checkout empty cart

```bash
curl -X POST http://localhost:8084/api/cart/checkout ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: 400 Bad Request with message "Cart is empty".

### Test 17: Cart is NOT cleared after checkout

```bash
curl -X GET http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: Cart still has items (cart is NOT cleared automatically).

### Test 18: Unauthenticated request (no token)

```bash
curl -X GET http://localhost:8084/api/cart
```

Expected: 401 Unauthorized or 403 Forbidden.

### Test 19: Request with invalid token

```bash
curl -X GET http://localhost:8084/api/cart ^
  -H "Authorization: Bearer invalid-token-here"
```

Expected: 401/403 (token rejected by JwtAuthenticationFilter).

### Test 20: Redis cache is working

1. Call GET `/api/cart` twice quickly.
2. Second call should be faster (cache hit).
3. Check Redis directly:
```bash
docker exec redis redis-cli KEYS "cart:*"
```
Expected: Key `cart:1` (or whatever userId) exists.

4. After a write operation (add/update/remove), verify cache is invalidated:
```bash
docker exec redis redis-cli KEYS "cart:*"
```
Expected: Key should be deleted after write.

### Test 21: Add INACTIVE product is rejected

If ProductService returns a product with `status: "INACTIVE"`:

```bash
curl -X POST http://localhost:8084/api/cart/items ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"variantId\":\"INACTIVE_VARIANT_ID\",\"quantity\":1}"
```

Expected: 400 Bad Request with message "Product '...' is inactive".

### Test 22: Validate cart detects INACTIVE products

If a cart item's product becomes INACTIVE:

```bash
curl -X POST http://localhost:8084/api/cart/validate ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected (if product is inactive):
```json
{
  "valid": false,
  "errors": [
    {
      "variantId": "...",
      "reason": "PRODUCT_INACTIVE",
      "message": "Product '...' không còn hoạt động"
    }
  ]
}
```

### Test 23: Clear cart after checkout (idempotent)

After checkout, clear the cart:

```bash
curl -X POST http://localhost:8084/api/cart/checkout/clear ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: 204 No Content.

Verify cart is empty:
```bash
curl -X GET http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"
```
Expected: `items: []`.

### Test 24: Clear cart after checkout is idempotent (call twice)

```bash
curl -X POST http://localhost:8084/api/cart/checkout/clear ^
  -H "Authorization: Bearer %TOKEN%"
```

Expected: 204 No Content (no error, even though cart is already empty).

### Test 25: Full checkout flow

```bash
# Step 1: Add items
curl -X POST http://localhost:8084/api/cart/items ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"variantId\":\"YOUR_VARIANT_ID\",\"quantity\":2}"

# Step 2: Validate
curl -X POST http://localhost:8084/api/cart/validate ^
  -H "Authorization: Bearer %TOKEN%"

# Step 3: Checkout (cart NOT cleared)
curl -X POST http://localhost:8084/api/cart/checkout ^
  -H "Authorization: Bearer %TOKEN%"

# Step 4: Verify cart still has items
curl -X GET http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"

# Step 5: Clear cart after order confirmed
curl -X POST http://localhost:8084/api/cart/checkout/clear ^
  -H "Authorization: Bearer %TOKEN%"

# Step 6: Verify cart is empty
curl -X GET http://localhost:8084/api/cart ^
  -H "Authorization: Bearer %TOKEN%"
```

---

## Quick Test Script (PowerShell)

Save as `test-cart.ps1` and run from project root:

```powershell
$BASE = "http://localhost:8084"
$TOKEN = "YOUR_JWT_TOKEN_HERE"
$HEADERS = @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" }
$VARIANT_ID = "YOUR_VARIANT_ID_HERE"

Write-Host "=== Test 1: View Cart ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$BASE/api/cart" -Headers @{ "Authorization" = "Bearer $TOKEN" } | ConvertTo-Json

Write-Host "=== Test 2: Add Item ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$BASE/api/cart/items" -Method POST -Headers $HEADERS -Body (@{ variantId = $VARIANT_ID; quantity = 2 } | ConvertTo-Json) | ConvertTo-Json

Write-Host "=== Test 3: View Cart (should have item) ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$BASE/api/cart" -Headers @{ "Authorization" = "Bearer $TOKEN" } | ConvertTo-Json

Write-Host "=== Test 4: Validate Cart ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$BASE/api/cart/validate" -Method POST -Headers @{ "Authorization" = "Bearer $TOKEN" } | ConvertTo-Json

Write-Host "=== Test 5: Checkout ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$BASE/api/cart/checkout" -Method POST -Headers @{ "Authorization" = "Bearer $TOKEN" } | ConvertTo-Json

Write-Host "=== Test 6: Clear Cart ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$BASE/api/cart" -Method DELETE -Headers @{ "Authorization" = "Bearer $TOKEN" }
Write-Host "Cart cleared (204)"

Write-Host "=== All tests completed ===" -ForegroundColor Green
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `JWT secret must be at least 32 bytes` | Ensure `JWT_SECRET` in `.env` is at least 32 characters |
| `Cannot fetch product info from ProductService` | ProductService must be running and accessible at `product.service.url` |
| `Cart not found` | Call GET `/api/cart` first to auto-create cart, or add an item |
| Connection refused to MariaDB | Ensure `docker compose up -d mariadb` and DB `cart_db` exists |
| Connection refused to Redis | Ensure `docker compose up -d redis` |
| 401 on all endpoints | JWT token is invalid or expired. Check token generation |
| Eureka registration failed | Ensure `docker compose up -d discovery-server` is healthy |
