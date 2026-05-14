# Extract RecommendationService — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the recommendation system from ProductService into a standalone RecommendationService Node.js microservice, with all APIs under `/api/recommendations/**`.

**Architecture:** RecommendationService is an Express + ES Modules service (port 8086) owning `d4c_user_behaviors` and `d4c_user_scores` DynamoDB tables. It calls ProductService via HTTP (`http://productservice:8082`) for product data. API Gateway routes `/api/recommendations/**` → `lb://RECOMMENDATIONSERVICE`.

**Tech Stack:** Node.js 20, Express 4, AWS SDK v3 (DynamoDB), eureka-js-client, axios, uuid, dotenv, morgan

---

### Task 1: Create RecommendationService scaffold

**Files:**
- Create: `RecommendationService/.gitignore`
- Create: `RecommendationService/.dockerignore`
- Create: `RecommendationService/.env.example`
- Create: `RecommendationService/package.json`
- Create: `RecommendationService/Dockerfile`

- [ ] **Step 1: Create .gitignore**

Copy from ProductService's `.gitignore` — identical content:

```
# 1. DEPENDENCIES (Thư viện)
# Chặn thư mục node_modules ở bất kỳ đâu trong project (cả frontend lẫn backend)
node_modules/
.pnp
.pnp.js

# 2. MÔI TRƯỜNG & BẢO MẬT (Environment)
# Chặn TẤT CẢ các file liên quan đến biến môi trường
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# (Tuỳ chọn) Nếu bạn muốn cho phép push file .env.example để làm mẫu cho team thì bỏ comment dòng dưới
# !.env.example

# 3. KẾT QUẢ BUILD (Build Outputs)
# Chặn các file build ra từ Vite (Frontend)
dist/
dist-ssr/
build/

# 4. LOGS (File ghi chú lỗi)
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# 5. CÁC FILE HỆ ĐIỀU HÀNH & EDITOR
# macOS
.DS_Store

# Windows
Thumbs.db

# VSCode / WebStorm (Cấu hình cá nhân của code editor)
.vscode/*
!.vscode/extensions.json
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

- [ ] **Step 2: Create .dockerignore**

```
node_modules
.git
.gitignore
Dockerfile
docker-compose*.yml
npm-debug.log*
yarn-error.log*
.env
.env.*
coverage
.vscode
.idea
```

- [ ] **Step 3: Create .env.example**

```
PORT=
SERVICE_NAME=
SERVICE_HOST=
SERVICE_IP=
EUREKA_HOST=
EUREKA_PORT=
EUREKA_SERVICE_PATH=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
BEHAVIOR_TABLE_NAME=
SCORE_TABLE_NAME=
PRODUCT_SERVICE_URL=
```

- [ ] **Step 4: Create package.json**

```json
{
  "name": "recommendation-service",
  "version": "1.0.0",
  "description": "Recommendation Service for D4C Clothing Shop",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.556.0",
    "@aws-sdk/lib-dynamodb": "^3.556.0",
    "axios": "^1.7.2",
    "dotenv": "^16.4.5",
    "eureka-js-client": "^4.5.0",
    "express": "^4.19.2",
    "morgan": "^1.10.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

- [ ] **Step 5: Run npm install**

```powershell
npm install
```

Run from: `RecommendationService/`

- [ ] **Step 6: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .
USER nodeuser
EXPOSE 8086
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:8086/health >/dev/null || exit 1
CMD ["node", "src/index.js"]
```

- [ ] **Step 7: Commit**

```bash
git add RecommendationService/.gitignore RecommendationService/.dockerignore RecommendationService/.env.example RecommendationService/package.json RecommendationService/Dockerfile
git commit -m "recommendation-service: scaffold project"
```

---

### Task 2: Create configuration files

**Files:**
- Create: `RecommendationService/src/config/aws.config.js`
- Create: `RecommendationService/src/config/eureka.config.js`
- Create: `RecommendationService/src/config/product-service-client.js`

- [ ] **Step 1: Create aws.config.js (no S3 client)**

```js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const region = process.env.AWS_REGION || "ap-southeast-1";

const dynamoClientBase = new DynamoDBClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamoClient = DynamoDBDocumentClient.from(dynamoClientBase, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export { dynamoClient };
```

- [ ] **Step 2: Create eureka.config.js**

```js
import { Eureka } from "eureka-js-client";

const SERVICE_NAME = process.env.SERVICE_NAME || "RecommendationService";
const SERVICE_HOST = process.env.SERVICE_HOST || "localhost";
const SERVICE_IP = process.env.SERVICE_IP || "127.0.0.1";
const SERVICE_PORT = Number(process.env.PORT || 8086);
const EUREKA_HOST = process.env.EUREKA_HOST || "localhost";
const EUREKA_PORT = Number(process.env.EUREKA_PORT || 8761);
const EUREKA_SERVICE_PATH = process.env.EUREKA_SERVICE_PATH || "/eureka/apps/";

const eurekaClient = new Eureka({
  instance: {
    app: SERVICE_NAME,
    instanceId: `${SERVICE_NAME}:${SERVICE_HOST}:${SERVICE_PORT}`,
    hostName: SERVICE_HOST,
    ipAddr: SERVICE_IP,

    statusPageUrl: `http://${SERVICE_HOST}:${SERVICE_PORT}/health`,
    healthCheckUrl: `http://${SERVICE_HOST}:${SERVICE_PORT}/health`,

    port: {
      $: SERVICE_PORT,
      "@enabled": true,
    },

    vipAddress: SERVICE_NAME,
    dataCenterInfo: {
      "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo",
      name: "MyOwn",
    },
  },

  eureka: {
    host: EUREKA_HOST,
    port: EUREKA_PORT,
    servicePath: EUREKA_SERVICE_PATH,
  },
});

export default eurekaClient;
```

- [ ] **Step 3: Create product-service-client.js**

```js
import axios from "axios";

export const productServiceClient = axios.create({
  baseURL: process.env.PRODUCT_SERVICE_URL || "http://productservice:8082",
  timeout: 10000,
});
```

- [ ] **Step 4: Commit**

```bash
git add RecommendationService/src/config/
git commit -m "recommendation-service: add config (AWS, Eureka, ProductService client)"
```

---

### Task 3: Create data models

**Files:**
- Create: `RecommendationService/src/models/behavior.model.js`
- Create: `RecommendationService/src/models/recommendation.model.js`

- [ ] **Step 1: Create behavior.model.js** (extract from `ProductService/src/models/behavior.model.js`, change import path)

```js
import { dynamoClient } from "../config/aws.config.js";
import {
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const TABLE_NAME = process.env.BEHAVIOR_TABLE_NAME || "d4c_user_behaviors";

/**
 * Model for user behavior events table (DynamoDB)
 *
 * Table schema (to be created in AWS):
 *   PK: id (String)
 *   GSI: userId-createdAt-index  (userId → sort by createdAt)
 *
 * Item shape:
 * {
 *   id:          string   (UUID)
 *   userId:      string
 *   productId:   string
 *   eventType:   "view" | "add_to_cart" | "buy_now" | "purchased"
 *   createdAt:   string   (ISO)
 * }
 */
class BehaviorModel {
  /**
   * Record a single behavior event.
   */
  async putEvent({ userId, productId, eventType }) {
    const item = {
      id: uuidv4(),
      userId,
      productId,
      eventType,
      createdAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    });

    await dynamoClient.send(command);
    return item;
  }

  /**
   * Get all behavior events for a user (scan fallback – use GSI in prod).
   */
  async findByUserId(userId) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false,
      });
      const response = await dynamoClient.send(command);
      return response.Items || [];
    } catch {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
      });
      const response = await dynamoClient.send(command);
      return (response.Items || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }
  }
}

export const behaviorModel = new BehaviorModel();
```

- [ ] **Step 2: Create recommendation.model.js** (extract from `ProductService/src/models/recommendation.model.js`, change import path)

```js
import { dynamoClient } from "../config/aws.config.js";
import {
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const TABLE_NAME = process.env.SCORE_TABLE_NAME || "d4c_user_scores";

/**
 * Model for user-product score aggregation (DynamoDB)
 *
 * Table schema (to be created in AWS):
 *   PK: userId (String)
 *   SK: productId (String)
 *   GSI: userId-score-index  (userId → sort by score DESC)
 *
 * Item shape:
 * {
 *   userId:    string
 *   productId: string
 *   score:     number  (accumulated)
 *   updatedAt: string  (ISO)
 * }
 */
class RecommendationModel {
  /**
   * Add delta score for a (userId, productId) pair.
   * Creates the item if not exists (upsert).
   */
  async upsertScore(userId, productId, delta) {
    try {
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId, productId },
        UpdateExpression:
          "SET #score = if_not_exists(#score, :zero) + :delta, #updatedAt = :now",
        ExpressionAttributeNames: {
          "#score": "score",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":delta": delta,
          ":zero": 0,
          ":now": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      });
      const response = await dynamoClient.send(command);
      return response.Attributes;
    } catch {
      const item = {
        userId,
        productId,
        score: delta,
        updatedAt: new Date().toISOString(),
      };
      await dynamoClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return item;
    }
  }

  /**
   * Get top-scored products for a user.
   * Uses GSI if available, otherwise scan + filter.
   */
  async findTopByUserId(userId, limit = 20) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "userId-score-index",
        KeyConditionExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false,
        Limit: limit,
      });
      const response = await dynamoClient.send(command);
      return response.Items || [];
    } catch {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
      });
      const response = await dynamoClient.send(command);
      const items = response.Items || [];
      return items
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, limit);
    }
  }
}

export const recommendationModel = new RecommendationModel();
```

- [ ] **Step 3: Commit**

```bash
git add RecommendationService/src/models/
git commit -m "recommendation-service: add DynamoDB models (behaviors, scores)"
```

---

### Task 4: Create recommendation service (core algorithm)

**Files:**
- Create: `RecommendationService/src/services/recommendation.service.js`

- [ ] **Step 1: Create recommendation.service.js**

Replaces internal `productService.*` calls with HTTP calls to `productServiceClient`. ProductService REST API response formats:
- `GET /api/products/:id` → returns a single product object (with variants + category populated)
- `GET /api/products` → returns `{ data: Product[], total, page, limit, totalPages }`
- `GET /api/products/featured` → returns `Product[]`

```js
import { behaviorModel } from "../models/behavior.model.js";
import { recommendationModel } from "../models/recommendation.model.js";
import { productServiceClient } from "../config/product-service-client.js";

// ─── Behavior event weights ────────────────────────────────────────────────────
const EVENT_WEIGHTS = {
  view: 1,
  add_to_cart: 3,
  buy_now: 5,
  purchased: 10,
};

// Minimum scored products before we stop showing cold-start fallback
const COLD_START_THRESHOLD = 3;

class RecommendationService {
  /**
   * Record a user behavior event and update the score for that product.
   * @param {string} userId
   * @param {string} productId
   * @param {"view"|"add_to_cart"|"buy_now"|"purchased"} eventType
   */
  async recordBehavior(userId, productId, eventType) {
    const weight = EVENT_WEIGHTS[eventType];
    if (weight === undefined) {
      throw new Error(
        `eventType không hợp lệ. Chấp nhận: ${Object.keys(EVENT_WEIGHTS).join(", ")}`
      );
    }

    // Fire-and-forget parallel: record event + update score
    const [event] = await Promise.all([
      behaviorModel.putEvent({ userId, productId, eventType }),
      recommendationModel.upsertScore(userId, productId, weight),
    ]);

    return event;
  }

  /**
   * Get personalised recommendations for a user.
   * Calls ProductService API for product data instead of accessing d4c_products directly.
   *
   * @param {string} userId
   * @param {number} limit
   * @returns {Promise<Object[]>}
   */
  async getRecommendations(userId, limit = 10) {
    // 1. Get user's top-scored products
    const topScores = await recommendationModel.findTopByUserId(userId, 10);

    // Cold start – not enough data yet
    if (topScores.length < COLD_START_THRESHOLD) {
      const res = await productServiceClient.get("/api/products/featured");
      return res.data;
    }

    // 2. Build set of already-interacted product IDs
    const interactedIds = new Set(topScores.map((s) => s.productId));

    // 3. Fetch full details for top-scored products via ProductService API
    const topProducts = await Promise.all(
      topScores.map((s) =>
        productServiceClient
          .get(`/api/products/${s.productId}`)
          .then((res) => res.data)
          .catch(() => null)
      )
    );
    const validTopProducts = topProducts.filter(Boolean);

    // 4. Collect preference signals
    const preferredCategories = new Set();
    const preferredBrands = new Set();
    const preferredGenders = new Set();

    for (const p of validTopProducts) {
      if (p.categoryId) preferredCategories.add(p.categoryId);
      if (p.brand) preferredBrands.add(p.brand.toLowerCase());
      if (p.gender) preferredGenders.add(p.gender.toLowerCase());
    }

    // 5. Get all products from ProductService, score candidates by preference overlap
    const allRes = await productServiceClient.get("/api/products");
    const allProducts = allRes.data.data || [];

    const scored = allProducts
      .filter((p) => !interactedIds.has(p.id))
      .map((p) => {
        let candidateScore = 0;
        if (preferredCategories.has(p.categoryId)) candidateScore += 3;
        if (preferredBrands.has((p.brand || "").toLowerCase())) candidateScore += 2;
        if (preferredGenders.has((p.gender || "").toLowerCase())) candidateScore += 1;
        return { product: p, candidateScore };
      })
      .filter((x) => x.candidateScore > 0)
      .sort((a, b) => b.candidateScore - a.candidateScore)
      .slice(0, limit)
      .map((x) => x.product);

    // If still not enough results, supplement with featured products
    if (scored.length < limit) {
      const featuredRes = await productServiceClient.get("/api/products/featured");
      const featured = featuredRes.data;
      const supplemented = featured.filter(
        (p) => !interactedIds.has(p.id) && !scored.find((s) => s.id === p.id)
      );
      return [...scored, ...supplemented].slice(0, limit);
    }

    return scored;
  }
}

export const recommendationService = new RecommendationService();
```

**Key changes from original:**
- `import { productService } from "./product.service.js"` → `import { productServiceClient } from "../config/product-service-client.js"`
- `productService.getProductById(id)` → `productServiceClient.get(`/api/products/${id}`).then(res => res.data)`
- `productService.getAllProducts()` → `productServiceClient.get("/api/products").then(res => res.data.data)` (extract from paginated wrapper)
- `productService.getFeaturedProducts()` → `productServiceClient.get("/api/products/featured").then(res => res.data)`

- [ ] **Step 2: Commit**

```bash
git add RecommendationService/src/services/recommendation.service.js
git commit -m "recommendation-service: add recommendation engine (HTTP-based product queries)"
```

---

### Task 5: Create controller and routes

**Files:**
- Create: `RecommendationService/src/controllers/recommendation.controller.js`
- Create: `RecommendationService/src/routes/recommendation.routes.js`

- [ ] **Step 1: Create recommendation.controller.js**

Same as original but with updated JSDoc comments for new paths:

```js
import { recommendationService } from "../services/recommendation.service.js";

/**
 * POST /api/recommendations/behaviors
 * Body: { userId, productId, eventType }
 */
export const recordBehavior = async (req, res) => {
  try {
    const { userId, productId, eventType } = req.body;

    if (!userId || !productId || !eventType) {
      return res.status(400).json({
        message: "Thiếu tham số bắt buộc: userId, productId, eventType",
      });
    }

    const event = await recommendationService.recordBehavior(
      userId,
      productId,
      eventType
    );
    res.status(200).json({ success: true, event });
  } catch (error) {
    if (error.message.startsWith("eventType không hợp lệ")) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Lỗi ghi behavior:", error);
    res.status(500).json({ message: "Lỗi server khi ghi hành vi", error: error.message });
  }
};

/**
 * GET /api/recommendations?userId=&limit=
 */
export const getRecommendations = async (req, res) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "Thiếu tham số userId" });
    }

    const limitNum = Math.min(48, Math.max(1, Number(limit) || 10));
    const products = await recommendationService.getRecommendations(userId, limitNum);
    res.status(200).json(products);
  } catch (error) {
    console.error("Lỗi lấy recommendations:", error);
    res.status(500).json({
      message: "Lỗi server khi lấy sản phẩm đề xuất",
      error: error.message,
    });
  }
};
```

- [ ] **Step 2: Create recommendation.routes.js**

Single router mounting both endpoints:

```js
import express from "express";
import {
  recordBehavior,
  getRecommendations,
} from "../controllers/recommendation.controller.js";

const recommendationRouter = express.Router();

recommendationRouter.post("/behaviors", recordBehavior);
recommendationRouter.get("/", getRecommendations);

export { recommendationRouter };
```

- [ ] **Step 3: Commit**

```bash
git add RecommendationService/src/controllers/ RecommendationService/src/routes/
git commit -m "recommendation-service: add controller and routes"
```

---

### Task 6: Create entry point (index.js)

**Files:**
- Create: `RecommendationService/src/index.js`

- [ ] **Step 1: Create index.js**

```js
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import { recommendationRouter } from "./routes/recommendation.routes.js";
import eurekaClient from "./config/eureka.config.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8086;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/recommendations", recommendationRouter);

app.get("/health", (req, res) => {
  res.json({
    name: "Recommendation Service",
    status: "UP",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);

  eurekaClient.start((err) => {
    if (err) {
      console.error("Eureka registration failed", err);
    } else {
      console.log("Registered with Eureka");
    }
  });
});

process.on("SIGINT", () => {
  eurekaClient.stop(() => {
    console.log("Eureka client stopped");
    process.exit();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add RecommendationService/src/index.js
git commit -m "recommendation-service: add Express entry point"
```

---

### Task 7: Remove recommendation code from ProductService

**Files:**
- Modify: `ProductService/src/index.js` — remove route imports and registrations
- Delete: `ProductService/src/controllers/recommendation.controller.js`
- Delete: `ProductService/src/routes/recommendation.routes.js`
- Delete: `ProductService/src/services/recommendation.service.js`
- Delete: `ProductService/src/models/recommendation.model.js`
- Delete: `ProductService/src/models/behavior.model.js`

- [ ] **Step 1: Remove routes from ProductService/src/index.js**

Change lines 7, 27-28:

```diff
  import productRoutes from "./routes/product.routes.js";
  import categoryRoutes from "./routes/category.routes.js";
- import { behaviorRouter, recommendationRouter } from "./routes/recommendation.routes.js";
  import eurekaClient from "./config/eureka.config.js";
```

```diff
  app.use("/api/products", productRoutes);
  app.use("/api/categories", categoryRoutes);
- app.use("/api/behaviors", behaviorRouter);
- app.use("/api/recommendations", recommendationRouter);
```

- [ ] **Step 2: Delete 5 recommendation files from ProductService**

```powershell
Remove-Item -LiteralPath "ProductService\src\controllers\recommendation.controller.js"
Remove-Item -LiteralPath "ProductService\src\routes\recommendation.routes.js"
Remove-Item -LiteralPath "ProductService\src\services\recommendation.service.js"
Remove-Item -LiteralPath "ProductService\src\models\recommendation.model.js"
Remove-Item -LiteralPath "ProductService\src\models\behavior.model.js"
```

- [ ] **Step 3: Clean up ProductService .env** (remove unused recommendation env vars)

Remove these lines from `ProductService/.env`:
```
BEHAVIOR_TABLE_NAME=d4c_user_behaviors
SCORE_TABLE_NAME=d4c_user_scores
```

- [ ] **Step 4: Commit**

```bash
git add ProductService/src/index.js ProductService/.env
git rm ProductService/src/controllers/recommendation.controller.js ProductService/src/routes/recommendation.routes.js ProductService/src/services/recommendation.service.js ProductService/src/models/recommendation.model.js ProductService/src/models/behavior.model.js
git commit -m "product-service: remove recommendation code (moved to RecommendationService)"
```

---

### Task 8: Update API Gateway routing

**Files:**
- Modify: `Api-Gateway/src/main/resources/application.properties`

- [ ] **Step 1: Remove behavior-route and update recommendation-route**

Remove the behavior-route (lines 36-38) and change recommendation-route target (line 41):

```diff
- spring.cloud.gateway.routes[7].id=behavior-route
- spring.cloud.gateway.routes[7].uri=lb://PRODUCTSERVICE
- spring.cloud.gateway.routes[7].predicates[0]=Path=/api/behaviors/**
-
  spring.cloud.gateway.routes[8].id=recommendation-route
- spring.cloud.gateway.routes[8].uri=lb://PRODUCTSERVICE
+ spring.cloud.gateway.routes[8].uri=lb://RECOMMENDATIONSERVICE
  spring.cloud.gateway.routes[8].predicates[0]=Path=/api/recommendations/**
```

Note: Since we removed a route, the remaining `recommendation-route` stays at index 8. Spring Cloud Gateway uses 0-based indexing — route indices don't need to be consecutive, but for cleanliness we can renumber. However, renumbering all routes is risky. Keep index 8 for safety.

- [ ] **Step 2: Commit**

```bash
git add Api-Gateway/src/main/resources/application.properties
git commit -m "api-gateway: route /api/recommendations/** to RecommendationService"
```

---

### Task 9: Add RecommendationService to Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`

- [ ] **Step 1: Add recommendationservice to docker-compose.yml**

Insert after `notificationservice` block (after line 152):

```yaml
  recommendationservice:
    build:
      context: ./RecommendationService
      dockerfile: Dockerfile
    container_name: recommendationservice
    hostname: recommendationservice
    depends_on:
      discovery-server:
        condition: service_healthy
    env_file:
      - ./RecommendationService/.env
    ports:
      - "8086:8086"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8086/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 25s
    networks:
      - d4c-net
```

- [ ] **Step 2: Add recommendationservice to api-gateway depends_on**

Add `recommendationservice` to the api-gateway depends_on block (after `cartservice` block):

```diff
+       recommendationservice:
+         condition: service_healthy
```

- [ ] **Step 3: Add dev overrides to docker-compose.dev.yml**

Insert after the `productservice:` dev block:

```yaml
  recommendationservice:
    command: ["npm", "run", "dev"]
    volumes:
      - ./RecommendationService:/app
      - recommendation_node_modules:/app/node_modules
```

And add the volume to the `volumes:` section at the bottom:

```diff
  volumes:
    frontend_node_modules:
    product_node_modules:
+   recommendation_node_modules:
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "docker: add RecommendationService to compose"
```

---

### Task 10: Update frontend behavior API URL

**Files:**
- Modify: `frontend/src/services/productApi.ts`

- [ ] **Step 1: Update recordBehavior URL**

Change line 245 from `/api/behaviors` to `/api/recommendations/behaviors`:

```diff
  export const recordBehavior = async (
    userId: string,
    productId: string,
    eventType: BehaviorEventType,
  ): Promise<void> => {
    return axiosInstance
-     .post("/api/behaviors", { userId, productId, eventType })
+     .post("/api/recommendations/behaviors", { userId, productId, eventType })
      .then(() => undefined)
      .catch(() => undefined); // fire-and-forget, never block UI
  };
```

Also update the JSDoc comment on line 236:

```diff
  /**
-  * POST /api/behaviors
+  * POST /api/recommendations/behaviors
   * Record a user behavior event for recommendation scoring.
   */
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/productApi.ts
git commit -m "frontend: update behavior API URL to /api/recommendations/behaviors"
```

---

### Task 11: Verification

- [ ] **Step 1: Verify all files are in place**

```powershell
Get-ChildItem -Recurse RecommendationService\
```

Expected output: All files from Tasks 1-6 exist.

- [ ] **Step 2: Verify ProductService clean**

Confirm the 5 recommendation files are deleted and index.js no longer references them:

```powershell
Get-ChildItem -Recurse ProductService\src\ -Name | Select-String "recommendation|behavior"
```

Expected: No matches.

- [ ] **Step 3: Build and run**

```powershell
docker compose up --build
```

Check that `recommendationservice` starts and healthcheck passes.

- [ ] **Step 4: Test behavior endpoint**

```powershell
curl -X POST http://localhost:8080/api/recommendations/behaviors -H "Content-Type: application/json" -d '{"userId":"test-user","productId":"test-product","eventType":"view"}'
```

Expected: `{"success":true,"event":{"id":"...","userId":"test-user","productId":"test-product","eventType":"view","createdAt":"..."}}`

- [ ] **Step 5: Test recommendations endpoint**

```powershell
curl "http://localhost:8080/api/recommendations?userId=test-user&limit=4"
```

Expected: Array of products (may be empty or featured depending on data).

- [ ] **Step 6: Verify old behavior URL returns 404**

```powershell
curl -X POST http://localhost:8080/api/behaviors -H "Content-Type: application/json" -d '{"userId":"x","productId":"y","eventType":"view"}'
```

Expected: 404 (route removed from API Gateway).

- [ ] **Step 7: Verify frontend build**

```powershell
npm run build
```

Run from: `frontend/`

Expected: Build succeeds with no errors.
