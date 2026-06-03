# Product Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Redis-based caching to ProductService for featured, new-arrivals, product list, product detail, related products, and per-user recommendations.

**Architecture:** Cache-aside pattern. Each service method checks Redis first, falls through to DynamoDB on miss, caches result with TTL. Selective invalidation on product CRUD. RecommendationService calls ProductService cache endpoints instead of computing directly.

**Tech Stack:** Node.js/Express, Redis v6 (`redis` npm package), SHA-256 for filter hash keys.

---

### Task 1: Create Cache Service

**Files:**
- Create: `ProductService/src/services/cache.service.js`

- [ ] **Step 1: Write cache.service.js**

Create `ProductService/src/services/cache.service.js`:

```js
import { redisClient } from "../config/redis.config.js";
import crypto from "crypto";

export const TTL = {
  FEATURED: 600,
  NEW_ARRIVALS: 300,
  DETAIL: 900,
  RELATED: 600,
  LIST: 600,
  RECOMMENDATIONS: 1800,
};

export const keys = {
  featured: () => "product:featured",
  newArrivals: (limit) => `product:new-arrivals:${limit}`,
  detail: (productId) => `product:detail:${productId}`,
  related: (productId) => `product:related:${productId}`,
  list: (filters) => {
    const sorted = Object.keys(filters)
      .sort()
      .map((k) => `${k}=${filters[k]}`)
      .join("&");
    const hash = crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
    return `product:list:${hash}`;
  },
  recommendations: (userId) => `product:recommendations:${userId}`,
};

export async function cacheGet(key) {
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error("[Cache] GET error:", err.message);
    return null;
  }
}

export async function cacheSet(key, data, ttl) {
  try {
    await redisClient.set(key, JSON.stringify(data), { EX: ttl });
  } catch (err) {
    console.error("[Cache] SET error:", err.message);
  }
}

export async function cacheDel(key) {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error("[Cache] DEL error:", err.message);
  }
}

export async function cacheDelPattern(pattern) {
  try {
    const keys = [];
    let cursor = 0;
    do {
      const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error("[Cache] DEL pattern error:", err.message);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add ProductService/src/services/cache.service.js
git commit -m "feat: add centralized cache service with TTL constants and key builders"
```

---

### Task 2: Add Cache to Featured Products

**Files:**
- Modify: `ProductService/src/services/product.service.js`
- Test: Run `curl http://localhost:8082/api/products/featured` twice

- [ ] **Step 1: Modify product.service.js - getFeaturedProducts**

Import cache service at top of `product.service.js`:

```js
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, TTL, keys } from "./cache.service.js";
```

Replace `getFeaturedProducts` method:

```js
async getFeaturedProducts() {
  const cacheKey = keys.featured();
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const items = await productModel.findFeatured();
  const result = await Promise.all(items.map(p => this._populateRelations(p)));
  await cacheSet(cacheKey, result, TTL.FEATURED);
  return result;
}
```

- [ ] **Step 2: Test**

```bash
cd ProductService && npm run dev
# In another terminal:
curl http://localhost:8082/api/products/featured
# First call: hits DynamoDB, caches result
curl http://localhost:8082/api/products/featured
# Second call: returns cached data (faster)
```

- [ ] **Step 3: Commit**

```bash
git add ProductService/src/services/product.service.js
git commit -m "feat: add cache to featured products endpoint"
```

---

### Task 3: Add Cache to New Arrivals

**Files:**
- Modify: `ProductService/src/services/product.service.js`

- [ ] **Step 1: Modify getNewArrivals**

Replace `getNewArrivals` method:

```js
async getNewArrivals(limit = 8) {
  const cacheKey = keys.newArrivals(limit);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const items = await productModel.findLatest(limit);
  const result = await Promise.all(items.map(p => this._populateRelations(p)));
  await cacheSet(cacheKey, result, TTL.NEW_ARRIVALS);
  return result;
}
```

- [ ] **Step 2: Test**

```bash
curl "http://localhost:8082/api/products/new-arrivals?limit=8"
curl "http://localhost:8082/api/products/new-arrivals?limit=8"
```

- [ ] **Step 3: Commit**

```bash
git add ProductService/src/services/product.service.js
git commit -m "feat: add cache to new arrivals endpoint"
```

---

### Task 4: Add Cache to Product List (with filters)

**Files:**
- Modify: `ProductService/src/services/product.service.js`

- [ ] **Step 1: Modify getProductsWithFilters**

Replace `getProductsWithFilters` method:

```js
async getProductsWithFilters(query = {}) {
  const cacheKey = keys.list(query);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const {
    category,
    categoryId,
    gender,
    size,
    color,
    brand,
    minPrice,
    maxPrice,
    sort_by = "createdAt",
    sort_order = "desc",
    page = 1,
    limit = 12,
  } = query;

  const [allVariants, allCategories] = await Promise.all([
    variantModel.findAll(),
    categoryModel.findAll(),
  ]);

  const variantsByProductId = {};
  for (const v of allVariants) {
    if (!variantsByProductId[v.productId]) variantsByProductId[v.productId] = [];
    variantsByProductId[v.productId].push(v);
  }
  const categoryById = {};
  const categoryByName = {};
  for (const c of allCategories) {
    categoryById[c.id] = c;
    categoryByName[c.name.toLowerCase()] = c;
  }

  const filters = {};
  let catId = categoryId;
  if (!catId && category) {
    const matchedCat = categoryByName[category.toLowerCase()];
    catId = matchedCat ? matchedCat.id : "not-found";
  }
  if (catId) filters.categoryId = catId;
  if (gender) filters.gender = gender;
  if (brand) filters.brand = brand;
  if (minPrice !== undefined && minPrice !== "") filters.minPrice = minPrice;
  if (maxPrice !== undefined && maxPrice !== "") filters.maxPrice = maxPrice;

  let items = await productModel.findWithFilters(filters);

  const sizes = size ? size.split(",").map((s) => s.trim()) : [];
  const colors = color ? color.split(",").map((c) => c.trim().toLowerCase()) : [];

  const populatedItems = [];
  for (const item of items) {
    const variants = variantsByProductId[item.id] || [];
    let match = true;
    if (sizes.length > 0) {
      match = match && variants.some(v => sizes.includes(v.size) && Number(v.quantity) > 0);
    }
    if (colors.length > 0) {
      match = match && variants.some(v => colors.includes(v.color.toLowerCase()));
    }
    if (match) {
      item.variants = variants;
      item.category = categoryById[item.categoryId]?.name || null;
      populatedItems.push(item);
    }
  }

  items = populatedItems;

  const allowedSorts = ["name", "price", "createdAt"];
  const sortKey = allowedSorts.includes(sort_by) ? sort_by : "createdAt";
  const orderMultiplier = sort_order === "asc" ? 1 : -1;

  items.sort((a, b) => {
    const aFeatured = a.isFeatured === true ? 1 : 0;
    const bFeatured = b.isFeatured === true ? 1 : 0;
    if (bFeatured !== aFeatured) return bFeatured - aFeatured;
    if (sortKey === "name") return orderMultiplier * (a.name || "").localeCompare(b.name || "", "vi");
    if (sortKey === "price") return orderMultiplier * (Number(a.price) - Number(b.price));
    if (sortKey === "createdAt") return orderMultiplier * (new Date(a.createdAt) - new Date(b.createdAt));
    return 0;
  });

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const total = items.length;
  const totalPages = Math.ceil(total / limitNum);
  const startIdx = (pageNum - 1) * limitNum;
  const data = items.slice(startIdx, startIdx + limitNum);

  const result = { data, total, page: pageNum, limit: limitNum, totalPages };
  await cacheSet(cacheKey, result, TTL.LIST);
  return result;
}
```

- [ ] **Step 2: Test**

```bash
curl "http://localhost:8082/api/products?brand=nike&limit=12"
curl "http://localhost:8082/api/products?brand=nike&limit=12"
```

- [ ] **Step 3: Commit**

```bash
git add ProductService/src/services/product.service.js
git commit -m "feat: add cache to product list with filters"
```

---

### Task 5: Add Cache to Product Detail and Related Products

**Files:**
- Modify: `ProductService/src/services/product.service.js`

- [ ] **Step 1: Modify getProductById**

Replace `getProductById` method:

```js
async getProductById(id) {
  const cacheKey = keys.detail(id);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const product = await productModel.findById(id);
  if (!product) return null;
  const result = await this._populateRelations(product);
  await cacheSet(cacheKey, result, TTL.DETAIL);
  return result;
}
```

- [ ] **Step 2: Modify getRelatedProducts**

Replace `getRelatedProducts` method:

```js
async getRelatedProducts(productId) {
  const cacheKey = keys.related(productId);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const product = await productModel.findById(productId);
  if (!product) throw new Error("Không tìm thấy sản phẩm");
  const items = await productModel.findRelated(product.categoryId, productId, 6);
  const result = await Promise.all(items.map(p => this._populateRelations(p)));
  await cacheSet(cacheKey, result, TTL.RELATED);
  return result;
}
```

- [ ] **Step 3: Test**

```bash
curl http://localhost:8082/api/products/<some-product-id>
curl http://localhost:8082/api/products/<some-product-id>/related
```

- [ ] **Step 4: Commit**

```bash
git add ProductService/src/services/product.service.js
git commit -m "feat: add cache to product detail and related products"
```

---

### Task 6: Add Cache Invalidation on Product CRUD

**Files:**
- Modify: `ProductService/src/services/product.service.js`

- [ ] **Step 1: Add invalidation to createProduct**

At the end of `createProduct` method, before `return populated;`, add:

```js
// Invalidate caches
if (newProduct.isFeatured) {
  await cacheDel(keys.featured());
}
await cacheDelPattern("product:new-arrivals:*");
await cacheDelPattern("product:list:*");
```

- [ ] **Step 2: Add invalidation to updateProduct**

At the end of `updateProduct` method, before `return updated;`, add:

```js
// Invalidate caches
await cacheDel(keys.detail(id));
await cacheDelPattern("product:related:*");
await cacheDelPattern("product:list:*");
await cacheDelPattern("product:new-arrivals:*");
if (updateData.isFeatured !== undefined || existingProduct.isFeatured) {
  await cacheDel(keys.featured());
}
```

- [ ] **Step 3: Add invalidation to deleteProduct**

At the end of `deleteProduct` method, before `return { success: true... };`, add:

```js
// Invalidate caches
await cacheDel(keys.detail(id));
await cacheDelPattern("product:related:*");
await cacheDelPattern("product:list:*");
await cacheDelPattern("product:new-arrivals:*");
if (existingProduct.isFeatured) {
  await cacheDel(keys.featured());
}
```

- [ ] **Step 4: Test**

```bash
# Create a product, then check that featured/new-arrivals/list caches are invalidated
curl -X POST http://localhost:8082/api/products -F "name=Test" -F "price=100" -F "isFeatured=true"
# Next call to /featured should hit DynamoDB (cache was deleted)
curl http://localhost:8082/api/products/featured
```

- [ ] **Step 5: Commit**

```bash
git add ProductService/src/services/product.service.js
git commit -m "feat: add selective cache invalidation on product CRUD"
```

---

### Task 7: Add Category Cache Invalidation

**Files:**
- Modify: `ProductService/src/services/category.service.js`

- [ ] **Step 1: Read category.service.js**

Read `ProductService/src/services/category.service.js` to understand its structure.

- [ ] **Step 2: Add cache invalidation to category CRUD**

Import at top:
```js
import { cacheDel, cacheDelPattern, keys } from "./cache.service.js";
```

Add invalidation to `createCategory`, `updateCategory`, `deleteCategory` methods (at end of each, before return):

```js
await cacheDelPattern("product:list:*");
await cacheDelPattern("product:detail:*");
await cacheDelPattern("product:related:*");
await cacheDel(keys.featured());
await cacheDelPattern("product:new-arrivals:*");
```

- [ ] **Step 3: Commit**

```bash
git add ProductService/src/services/category.service.js
git commit -m "feat: add cache invalidation on category CRUD"
```

---

### Task 8: Add Recommendation Cache Endpoints to ProductService

**Files:**
- Create: `ProductService/src/controllers/cache.controller.js`
- Create: `ProductService/src/routes/cache.routes.js`
- Modify: `ProductService/src/routes/product.routes.js`

- [ ] **Step 1: Create cache.controller.js**

```js
import { cacheGet, cacheSet, TTL } from "../services/cache.service.js";
import { keys } from "../services/cache.service.js";

export const getCachedRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;
    const cached = await cacheGet(keys.recommendations(userId));
    if (!cached) {
      return res.status(404).json({ message: "No cached recommendations found" });
    }
    res.status(200).json(cached);
  } catch (error) {
    console.error("[Cache] GET recommendations error:", error);
    res.status(500).json({ message: "Cache error", error: error.message });
  }
};

export const cacheRecommendations = async (req, res) => {
  try {
    const { userId, data } = req.body;
    if (!userId || !data || !Array.isArray(data)) {
      return res.status(400).json({ message: "userId and data array are required" });
    }
    await cacheSet(keys.recommendations(userId), data, TTL.RECOMMENDATIONS);
    res.status(200).json({ message: "Recommendations cached", userId });
  } catch (error) {
    console.error("[Cache] SET recommendations error:", error);
    res.status(500).json({ message: "Cache error", error: error.message });
  }
};
```

- [ ] **Step 2: Create cache.routes.js**

```js
import express from "express";
import { getCachedRecommendations, cacheRecommendations } from "../controllers/cache.controller.js";

const router = express.Router();

router.get("/recommendations/:userId", getCachedRecommendations);
router.post("/recommendations", cacheRecommendations);

export default router;
```

- [ ] **Step 3: Register cache routes in product.routes.js**

Add at top of `product.routes.js`:
```js
import cacheRouter from "./cache.routes.js";
```

Add route mount BEFORE the special routes section (before `router.get("/search", ...)`):
```js
router.use("/cache", cacheRouter);
```

This makes the full paths: `GET /api/products/cache/recommendations/:userId` and `POST /api/products/cache/recommendations`. The `/cache` prefix avoids conflict with `/:id` route.

- [ ] **Step 4: Test**

```bash
# Cache recommendations
curl -X POST http://localhost:8082/api/products/cache/recommendations \
  -H "Content-Type: application/json" \
  -d '{"userId":"user123","data":[{"id":"p1","name":"Test"}]}'

# Get cached recommendations
curl http://localhost:8082/api/products/cache/recommendations/user123
```

- [ ] **Step 5: Commit**

```bash
git add ProductService/src/controllers/cache.controller.js ProductService/src/routes/cache.routes.js ProductService/src/routes/product.routes.js
git commit -m "feat: add recommendation cache endpoints to ProductService"
```

---

### Task 9: Update RecommendationService to Use Cache

**Files:**
- Modify: `RecommendationService/src/services/recommendation.service.js`
- Modify: `RecommendationService/src/config/product-service-client.js`

- [ ] **Step 1: Add cache check/get methods to product-service-client.js**

Read `RecommendationService/src/config/product-service-client.js` first.

Add two new functions:

```js
export async function getCachedRecommendations(userId) {
  const url = `${PRODUCT_SERVICE_URL}/api/products/cache/recommendations/${userId}`;
  try {
    const response = await axios.get(url, { timeout: 3000 });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    return null;
  }
}

export async function postCachedRecommendations(userId, data) {
  const url = `${PRODUCT_SERVICE_URL}/api/products/cache/recommendations`;
  try {
    await axios.post(url, { userId, data }, { timeout: 3000 });
  } catch (error) {
    console.error("[Recs] Failed to cache recommendations:", error.message);
  }
}
```

- [ ] **Step 2: Modify getRecommendations in recommendation.service.js**

At the start of `getRecommendations(userId, limit)`:

```js
// Check cache first
const cached = await getCachedRecommendations(userId);
if (cached) return cached;
```

At the end, before returning:

```js
// Cache the result
await postCachedRecommendations(userId, result);
return result;
```

- [ ] **Step 3: Commit**

```bash
git add RecommendationService/src/config/product-service-client.js RecommendationService/src/services/recommendation.service.js
git commit -m "feat: use ProductService cache for recommendations"
```

---

### Task 10: Verify Full Integration

- [ ] **Step 1: Start all services**

```bash
docker compose up -d redis
cd ProductService && npm run dev &
cd RecommendationService && npm run dev &
```

- [ ] **Step 2: Test all cached endpoints**

```bash
# Featured (first call = miss, second = hit)
curl http://localhost:8082/api/products/featured
curl http://localhost:8082/api/products/featured

# New arrivals
curl "http://localhost:8082/api/products/new-arrivals?limit=8"
curl "http://localhost:8082/api/products/new-arrivals?limit=8"

# Product detail
curl http://localhost:8082/api/products/<id>
curl http://localhost:8082/api/products/<id>

# Related products
curl http://localhost:8082/api/products/<id>/related

# Product list with filters
curl "http://localhost:8082/api/products?brand=D4C&limit=12"

# Recommendations
curl http://localhost:8087/api/recommendations?userId=test123&limit=10
curl http://localhost:8087/api/recommendations?userId=test123&limit=10
```

- [ ] **Step 3: Test cache invalidation**

```bash
# Create a featured product
curl -X POST http://localhost:8082/api/products -F "name=New Featured" -F "price=50" -F "isFeatured=true" -F "categoryId=cat1"
# Featured cache should be invalidated
curl http://localhost:8082/api/products/featured
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify caching integration"
```
