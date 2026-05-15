# AIService Eureka Service Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded service URLs in AIService with Eureka-based dynamic discovery, using `.env` URLs only as fallback.

**Architecture:** Create a generic Eureka-based axios client factory that resolves service URLs at request time via `eureka-js-client`, with round-robin load balancing and `.env` fallback. All 4 tool files will use pre-configured axios instances instead of direct `axios.get/post` with hardcoded URLs. Follows the same pattern as `RecommendationService/src/config/product-service-client.js`.

**Tech Stack:** Node.js (ES Modules), axios, eureka-js-client

---

## Eureka App Name Mapping

| Service | Eureka app name | Current `.env` key |
|---------|----------------|-------------------|
| ProductService | `ProductService` | `PRODUCT_SERVICE_URL` |
| CartService | `CartService` | `CART_SERVICE_URL` |
| OrderService | `ORDERSERVICE` | `ORDER_SERVICE_URL` |
| NotificationService | `NotificationService` | `NOTIFICATION_SERVICE_URL` |
| RecommendationService | `RecommendationService` | `RECOMMENDATION_SERVICE_URL` |

**Note:** OrderService registers as `ORDERSERVICE` (uppercase, per `OrderService/src/main/resources/application.properties:1`), all others use PascalCase.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `AIService/src/config/service-discovery.js` | **Create** | Generic Eureka resolver + axios client factory |
| `AIService/src/config/service-urls.js` | **Create** | Exports 5 pre-configured axios clients |
| `AIService/src/tools/productTools.js` | **Modify** | Use `productServiceClient` |
| `AIService/src/tools/cartOrderTools.js` | **Modify** | Use `cartServiceClient`, `orderServiceClient` |
| `AIService/src/tools/socialTools.js` | **Modify** | Use `notificationServiceClient`, `recommendationServiceClient` |
| `AIService/src/tools/adminStatsTools.js` | **Modify** | Use `orderServiceClient`, `productServiceClient` |

---

## Task 1: Create Eureka Service Discovery Client

**Files:**
- Create: `AIService/src/config/service-discovery.js`

- [ ] **Step 1: Create the generic service discovery module**

```js
import axios from "axios";
import eurekaClient from "./eureka.config.js";

// Fallback URLs from environment variables
const FALLBACK_URLS = {
  ProductService: process.env.PRODUCT_SERVICE_URL,
  CartService: process.env.CART_SERVICE_URL,
  ORDERSERVICE: process.env.ORDER_SERVICE_URL,
  NotificationService: process.env.NOTIFICATION_SERVICE_URL,
  RecommendationService: process.env.RECOMMENDATION_SERVICE_URL,
};

// Round-robin index per service
const serviceIndexes = {};

/**
 * Resolve service base URL from Eureka, fallback to env.
 * @param {string} appName - Eureka app name (e.g. "ProductService")
 * @returns {string} Base URL without trailing slash
 */
function resolveServiceUrl(appName) {
  const instances = eurekaClient.getInstancesByAppId(appName);

  if (!instances || instances.length === 0) {
    const fallback = FALLBACK_URLS[appName];
    if (fallback) {
      // Strip path suffix (e.g. "/api/v1") to get base URL
      return fallback.replace(/\/api\/v1$/, "");
    }
    throw new Error(`${appName} not found in Eureka and no fallback URL configured`);
  }

  if (!serviceIndexes[appName]) {
    serviceIndexes[appName] = 0;
  }

  const instance = instances[serviceIndexes[appName] % instances.length];
  serviceIndexes[appName]++;

  return `http://${instance.hostName}:${instance.port.$}`;
}

/**
 * Create an axios client that resolves service URLs via Eureka at request time.
 * @param {string} appName - Eureka app name
 * @param {string} [basePath=""] - Base path to prepend (e.g. "/api/v1")
 * @returns {import("axios").AxiosInstance}
 */
export function createServiceClient(appName, basePath = "") {
  const client = axios.create({ timeout: 10000 });

  client.interceptors.request.use((config) => {
    const baseUrl = resolveServiceUrl(appName);
    config.url = baseUrl + basePath + config.url;
    return config;
  });

  return client;
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check AIService/src/config/service-discovery.js`
Expected: No output (success)

---

## Task 2: Create Pre-configured Service Clients

**Files:**
- Create: `AIService/src/config/service-urls.js`

- [ ] **Step 1: Create the service URL exports module**

```js
import { createServiceClient } from "./service-discovery.js";

// Each client resolves URLs via Eureka at request time, with .env fallback
export const productServiceClient = createServiceClient("ProductService", "/api/products");
export const cartServiceClient = createServiceClient("CartService", "/api/v1");
export const orderServiceClient = createServiceClient("ORDERSERVICE", "/api/v1");
export const notificationServiceClient = createServiceClient("NotificationService", "/api/v1");
export const recommendationServiceClient = createServiceClient("RecommendationService", "/api/v1");
```

**Why these base paths:**
- `ProductService`: Tools call `/api/products` endpoints → base path `/api/products`
- `CartService`: Tools call `/api/v1/cart/...` → base path `/api/v1`
- `ORDERSERVICE`: Tools call `/api/v1/orders/...` → base path `/api/v1`
- `NotificationService`: Tools call `/api/v1/notifications/...` → base path `/api/v1`
- `RecommendationService`: Tools call `/api/v1/recommendations/...` → base path `/api/v1`

- [ ] **Step 2: Verify syntax**

Run: `node --check AIService/src/config/service-urls.js`
Expected: No output (success)

---

## Task 3: Update productTools.js

**Files:**
- Modify: `AIService/src/tools/productTools.js`

- [ ] **Step 1: Replace imports and URL constants (lines 1-7)**

Replace:
```js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:8082";
const PRODUCT_API_BASE = `${PRODUCT_SERVICE_URL.replace('/api/v1', '')}/api/products`;
```

With:
```js
import { productServiceClient } from "../config/service-urls.js";
```

- [ ] **Step 2: Update search_products handler (line 60 and 67)**

Replace:
```js
response = await axios.get(`${PRODUCT_API_BASE}/search`, { params });
```
With:
```js
response = await productServiceClient.get("/search", { params });
```

Replace:
```js
response = await axios.get(`${PRODUCT_API_BASE}`, { params });
```
With:
```js
response = await productServiceClient.get("/", { params });
```

- [ ] **Step 3: Update get_product_details handler (line 93)**

Replace:
```js
const response = await axios.get(`${PRODUCT_API_BASE}/${productId}`);
```
With:
```js
const response = await productServiceClient.get(`/${productId}`);
```

- [ ] **Step 4: Verify syntax**

Run: `node --check AIService/src/tools/productTools.js`
Expected: No output (success)

---

## Task 4: Update cartOrderTools.js

**Files:**
- Modify: `AIService/src/tools/cartOrderTools.js`

- [ ] **Step 1: Replace imports and URL constants (lines 1-7)**

Replace:
```js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CART_SERVICE_URL = process.env.CART_SERVICE_URL || "http://localhost:8084/api/v1";
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://localhost:8085/api/v1";
```

With:
```js
import { cartServiceClient, orderServiceClient } from "../config/service-urls.js";
```

- [ ] **Step 2: Update add_to_cart handler (line 61)**

Replace:
```js
const response = await axios.post(`${CART_SERVICE_URL}/cart/items`, payload);
```
With:
```js
const response = await cartServiceClient.post("/cart/items", payload);
```

- [ ] **Step 3: Update get_checkout_summary handler (line 75)**

Replace:
```js
const response = await axios.get(`${CART_SERVICE_URL}/cart/${userId}`);
```
With:
```js
const response = await cartServiceClient.get(`/cart/${userId}`);
```

- [ ] **Step 4: Verify syntax**

Run: `node --check AIService/src/tools/cartOrderTools.js`
Expected: No output (success)

---

## Task 5: Update socialTools.js

**Files:**
- Modify: `AIService/src/tools/socialTools.js`

- [ ] **Step 1: Replace imports and URL constants (lines 1-7)**

Replace:
```js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://notificationservice:8083/api/v1";
const RECOMMENDATION_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || "http://recommendationservice:8087/api/v1";
```

With:
```js
import { notificationServiceClient, recommendationServiceClient } from "../config/service-urls.js";
```

- [ ] **Step 2: Update get_notification_summary handler (line 44)**

Replace:
```js
const response = await axios.get(`${NOTIFICATION_SERVICE_URL}/notifications/user/${userId}`);
```
With:
```js
const response = await notificationServiceClient.get(`/notifications/user/${userId}`);
```

- [ ] **Step 3: Update get_personalized_recommendations handler (line 69)**

Replace:
```js
const response = await axios.get(`${RECOMMENDATION_SERVICE_URL}/recommendations/${userId}`);
```
With:
```js
const response = await recommendationServiceClient.get(`/recommendations/${userId}`);
```

- [ ] **Step 4: Verify syntax**

Run: `node --check AIService/src/tools/socialTools.js`
Expected: No output (success)

---

## Task 6: Update adminStatsTools.js

**Files:**
- Modify: `AIService/src/tools/adminStatsTools.js`

- [ ] **Step 1: Replace imports and URL constants (lines 1-7)**

Replace:
```js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://orderservice:8085/api/v1";
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://productservice:8082/api/v1";
```

With:
```js
import { orderServiceClient, productServiceClient } from "../config/service-urls.js";
```

- [ ] **Step 2: Update get_revenue_stats handler (line 68)**

Replace:
```js
const response = await axios.get(`${ORDER_SERVICE_URL}/orders/stats/revenue?period=${period}`);
```
With:
```js
const response = await orderServiceClient.get(`/orders/stats/revenue?period=${period}`);
```

- [ ] **Step 3: Update get_low_inventory_report handler (lines 91-92)**

Replace:
```js
const PRODUCT_API_BASE = `${PRODUCT_SERVICE_URL.replace('/api/v1', '')}/api/products`;
const response = await axios.get(`${PRODUCT_API_BASE}`);
```
With:
```js
const response = await productServiceClient.get("/");
```

- [ ] **Step 4: Update create_product handler (lines 131-132)**

Replace:
```js
const PRODUCT_API_BASE = `${PRODUCT_SERVICE_URL.replace('/api/v1', '')}/api/products`;
const response = await axios.post(`${PRODUCT_API_BASE}`, args);
```
With:
```js
const response = await productServiceClient.post("/", args);
```

- [ ] **Step 5: Update delete_product handler (lines 143-144)**

Replace:
```js
const PRODUCT_API_BASE = `${PRODUCT_SERVICE_URL.replace('/api/v1', '')}/api/products`;
await axios.delete(`${PRODUCT_API_BASE}/${productId}`);
```
With:
```js
await productServiceClient.delete(`/${productId}`);
```

- [ ] **Step 6: Verify syntax**

Run: `node --check AIService/src/tools/adminStatsTools.js`
Expected: No output (success)

---

## Task 7: Final Verification

- [ ] **Step 1: Run syntax checks on all files**

```bash
node --check AIService/src/config/service-discovery.js && \
node --check AIService/src/config/service-urls.js && \
node --check AIService/src/tools/productTools.js && \
node --check AIService/src/tools/cartOrderTools.js && \
node --check AIService/src/tools/socialTools.js && \
node --check AIService/src/tools/adminStatsTools.js
```
Expected: All pass, no output

- [ ] **Step 2: Verify no remaining direct axios imports in tool files**

```bash
grep -rn "import axios" AIService/src/tools/
```
Expected: No matches

- [ ] **Step 3: Verify no remaining hardcoded URL constants in tool files**

```bash
grep -rn "SERVICE_URL\|localhost:808" AIService/src/tools/
```
Expected: No matches

- [ ] **Step 4: Verify no remaining dotenv imports in tool files**

```bash
grep -rn "import dotenv\|require.*dotenv" AIService/src/tools/
```
Expected: No matches

- [ ] **Step 5: Commit**

```bash
git add AIService/
git commit -m "feat(AIService): replace hardcoded URLs with Eureka service discovery"
```

---

## Testing Strategy

**Manual testing** is the primary verification method (no test framework configured for AIService).

### Test 1: Eureka discovery works (Docker environment)

1. Start full stack: `docker compose up --build -d`
2. Verify all services registered: `curl http://localhost:8761` → check Eureka dashboard
3. Test AIService health: `curl http://localhost:8088/api/v1/ai/health` → `{"status":"UP"}`
4. Send a chat message that triggers a tool call:
```bash
curl -X POST http://localhost:8080/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tìm áo thun","userId":"test-user","role":"USER"}'
```
Expected: Response with product results (proves Eureka discovery → ProductService works)

### Test 2: Fallback works (Eureka unavailable)

1. Stop Eureka: `docker stop discovery-server`
2. Restart AIService with `.env` URLs pointing to `localhost:<port>`
3. Send same chat message
Expected: Still works via fallback URLs

### Test matrix for tool coverage

| Tool | Test command | Proves |
|------|-------------|--------|
| `search_products` | "Tìm áo thun" | ProductService via Eureka |
| `get_product_details` | "Chi tiết sản phẩm {id}" | ProductService via Eureka |
| `add_to_cart` | "Thêm vào giỏ" (logged in) | CartService via Eureka |
| `get_checkout_summary` | "Xem giỏ hàng" (logged in) | CartService via Eureka |
| `get_notification_summary` | "Thông báo của tôi" | NotificationService via Eureka |
| `get_personalized_recommendations` | "Gợi ý cho tôi" | RecommendationService via Eureka |
| `get_revenue_stats` | "Doanh thu hôm nay" (admin) | OrderService via Eureka |
| `get_low_inventory_report` | "Kho còn ít hàng" (admin) | ProductService via Eureka |
