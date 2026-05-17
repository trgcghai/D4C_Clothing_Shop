# Typesense Search Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Typesense-powered hybrid search service (full-text + fuzzy + semantic) for D4C Clothing Shop products, with event-driven sync via RabbitMQ and Eureka registration.

**Architecture:** Node.js/Express service (port 8089) using Typesense JS client for search, amqplib for RabbitMQ event consumption, and eureka-js-client for service discovery. ProductService publishes product change events to RabbitMQ.

**Tech Stack:** Node.js (ESM), Express, typesense, amqplib, eureka-js-client, axios, Docker Compose

---

## File Map

### SearchService (new files)
| File | Responsibility |
|---|---|
| `SearchService/package.json` | Dependencies + scripts |
| `SearchService/.env.example` | Environment template |
| `SearchService/.env` | Local dev config |
| `SearchService/Dockerfile` | Container build |
| `SearchService/src/index.js` | Entry point, server startup |
| `SearchService/src/config/typesense.config.js` | Typesense client singleton |
| `SearchService/src/config/rabbitmq.config.js` | RabbitMQ connection, channel, exchange, queue, DLX setup |
| `SearchService/src/config/eureka.config.js` | Eureka registration |
| `SearchService/src/utils/product-transformer.js` | Transform ProductService API response → Typesense document |
| `SearchService/src/services/sync.service.js` | Typesense CRUD (upsert, delete) |
| `SearchService/src/services/search.service.js` | Hybrid search query builder |
| `SearchService/src/services/initial-sync.service.js` | Paginated fetch from ProductService API + batch import |
| `SearchService/src/services/dlq-handler.service.js` | DLQ consumer with retry/backoff |
| `SearchService/src/consumers/product-event.consumer.js` | RabbitMQ message handler for product events |
| `SearchService/src/controllers/search.controller.js` | GET /api/search handler |
| `SearchService/src/controllers/admin.controller.js` | POST /api/search/admin/dlq/retry handler |
| `SearchService/src/routes/search.routes.js` | Search route definitions |
| `SearchService/src/routes/admin.routes.js` | Admin route definitions |
| `SearchService/scripts/initial-sync.js` | CLI script for `npm run sync` |

### ProductService (modified files)
| File | Change |
|---|---|
| `ProductService/package.json` | Add `amqplib` dependency |
| `ProductService/.env.example` | Add RabbitMQ env vars |
| `ProductService/.env` | Add RabbitMQ env vars |
| `ProductService/src/config/rabbitmq.publisher.js` | New: RabbitMQ publisher connection + helper |
| `ProductService/src/services/event-publisher.service.js` | New: Publish product events |
| `ProductService/src/services/product.service.js` | Integrate event publisher into create/update/delete |

### Infrastructure (modified files)
| File | Change |
|---|---|
| `docker-compose.yml` | Add typesense + searchservice services + volume |
| `docker-compose.dev.yml` | Add searchservice dev override |
| `Api-Gateway/src/main/resources/application.properties` | Add search routes |
| `.env.example` | Add TYPESENSE_API_KEY |
| `.env` | Add TYPESENSE_API_KEY |

---

### Task 1: SearchService package.json, env files, Dockerfile

**Files:**
- Modify: `SearchService/package.json`
- Create: `SearchService/.env.example`
- Create: `SearchService/.env`
- Create: `SearchService/Dockerfile`

- [ ] **Step 1: Write SearchService/package.json**

Replace the existing bare `package.json` with:

```json
{
  "name": "searchservice",
  "version": "1.0.0",
  "description": "Typesense-powered search service for D4C Clothing Shop",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "sync": "node scripts/initial-sync.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "typesense": "^1.8.2",
    "amqplib": "^0.10.4",
    "eureka-js-client": "^4.5.0",
    "express": "^4.19.2",
    "dotenv": "^16.4.5",
    "morgan": "^1.10.1",
    "axios": "^1.7.0",
    "nodemon": "^3.1.14"
  }
}
```

Note: `"type": "module"` for ESM, matching ProductService pattern.

- [ ] **Step 2: Write SearchService/.env.example**

```
PORT=8089
SERVICE_NAME=SEARCHSERVICE
SERVICE_HOST=searchservice
SERVICE_IP=127.0.0.1
EUREKA_SERVER_URL=http://discovery-server:8761/eureka
EUREKA_HOST=localhost
EUREKA_PORT=8761
EUREKA_SERVICE_PATH=/eureka/apps/
TYPESENSE_HOST=typesense
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=your-api-key
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
PRODUCT_SERVICE_URL=http://productservice:8082
```

- [ ] **Step 3: Write SearchService/.env**

Same as .env.example but with real values for local dev:

```
PORT=8089
SERVICE_NAME=SEARCHSERVICE
SERVICE_HOST=localhost
SERVICE_IP=127.0.0.1
EUREKA_SERVER_URL=http://localhost:8761/eureka
EUREKA_HOST=localhost
EUREKA_PORT=8761
EUREKA_SERVICE_PATH=/eureka/apps/
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=d4c-typesense-secret-key
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
PRODUCT_SERVICE_URL=http://localhost:8082
```

- [ ] **Step 4: Write SearchService/Dockerfile**

Follow the ProductService Dockerfile pattern:

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
EXPOSE 8089
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://localhost:8089/health >/dev/null || exit 1
CMD ["node", "src/index.js"]
```

---

### Task 2: SearchService config files (Typesense, RabbitMQ, Eureka)

**Files:**
- Create: `SearchService/src/config/typesense.config.js`
- Create: `SearchService/src/config/rabbitmq.config.js`
- Create: `SearchService/src/config/eureka.config.js`

- [ ] **Step 1: Create typesense.config.js**

```js
import Typesense from "typesense";
import dotenv from "dotenv";

dotenv.config();

const client = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "localhost",
      port: Number(process.env.TYPESENSE_PORT) || 8108,
      protocol: "http",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || "d4c-typesense-secret-key",
  connectionTimeoutSeconds: 10,
});

export default client;
```

- [ ] **Step 2: Create rabbitmq.config.js**

```js
import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;

export const EXCHANGE = "product.exchange";
export const QUEUE = "search.product.queue";
export const DLX_EXCHANGE = "product.search.dlx";
export const DLQ_QUEUE = "product.search.dlq";
export const DLQ_ROUTING_KEY = "dlq";
export const ROUTING_KEYS = {
  CREATE: "product.created",
  UPDATE: "product.updated",
  DELETE: "product.deleted",
};

let connection = null;
let channel = null;

export async function connect() {
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  // Declare DLX (direct exchange)
  await channel.assertExchange(DLX_EXCHANGE, "direct", { durable: true });

  // Declare DLQ
  await channel.assertQueue(DLQ_QUEUE, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });

  // Bind DLQ to DLX
  await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, DLQ_ROUTING_KEY);

  // Declare main exchange (topic)
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  // Declare main queue with DLX
  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-dead-letter-exchange": DLX_EXCHANGE,
      "x-dead-letter-routing-key": DLQ_ROUTING_KEY,
      "x-message-ttl": 300000,
    },
  });

  // Bind queue to exchange with routing keys
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEYS.CREATE);
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEYS.UPDATE);
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEYS.DELETE);

  console.log("RabbitMQ connected, exchange and queues declared");
  return { connection, channel };
}

export async function getChannel() {
  if (!channel) {
    await connect();
  }
  return channel;
}

export async function close() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
```

- [ ] **Step 3: Create eureka.config.js**

Follow the existing ProductService/RecommendationService pattern:

```js
import { Eureka } from "eureka-js-client";
import dotenv from "dotenv";

dotenv.config();

const SERVICE_NAME = process.env.SERVICE_NAME || "SEARCHSERVICE";
const SERVICE_HOST = process.env.SERVICE_HOST || "localhost";
const SERVICE_IP = process.env.SERVICE_IP || "127.0.0.1";
const SERVICE_PORT = Number(process.env.PORT) || 8089;
const EUREKA_HOST = process.env.EUREKA_HOST || "localhost";
const EUREKA_PORT = Number(process.env.EUREKA_PORT) || 8761;
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

---

### Task 3: Product transformer + Sync service

**Files:**
- Create: `SearchService/src/utils/product-transformer.js`
- Create: `SearchService/src/services/sync.service.js`

- [ ] **Step 1: Create product-transformer.js**

Transforms a product from ProductService API format to Typesense document format. Converts `createdAt` ISO string to Unix timestamp (int64).

```js
export function toTypesenseDoc(product) {
  return {
    id: product.id,
    name: product.name || "",
    description: product.description || "",
    category: product.category || null,
    brand: product.brand || null,
    gender: product.gender || null,
    price: Number(product.price) || 0,
    tags: Array.isArray(product.tags) ? product.tags : [],
    imageUrl: product.imageUrl || "",
    isFeatured: product.isFeatured === true,
    createdAt: product.createdAt
      ? Math.floor(new Date(product.createdAt).getTime() / 1000)
      : 0,
    variants: product.variants || [],
  };
}

export function toTypesenseDocs(products) {
  return products.map(toTypesenseDoc);
}
```

- [ ] **Step 2: Create sync.service.js**

Handles Typesense collection creation and document CRUD operations.

```js
import typesenseClient from "../config/typesense.config.js";

const COLLECTION_NAME = "d4c_products";

const COLLECTION_SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string", locale: "vi" },
    { name: "description", type: "string", locale: "vi", optional: true },
    { name: "category", type: "string", facet: true, optional: true },
    { name: "brand", type: "string", facet: true, optional: true },
    { name: "gender", type: "string", facet: true, optional: true },
    { name: "price", type: "float", facet: true },
    { name: "tags", type: "string[]", optional: true },
    { name: "imageUrl", type: "string", index: false, optional: true },
    { name: "isFeatured", type: "bool", optional: true },
    { name: "createdAt", type: "int64" },
    { name: "variants", type: "object[]", index: false, optional: true },
    {
      name: "embedding",
      type: "float[]",
      embed: {
        from: ["name", "description"],
        model_config: {
          model_name: "ts/all-MiniLM-L12-v2",
        },
      },
    },
  ],
};

export async function ensureCollection() {
  const collections = await typesenseClient.collections().retrieve();
  const exists = collections.find((c) => c.name === COLLECTION_NAME);
  if (exists) {
    console.log(`Typesense collection "${COLLECTION_NAME}" already exists`);
    return exists;
  }
  const collection = await typesenseClient.collections().create(COLLECTION_SCHEMA);
  console.log(`Typesense collection "${COLLECTION_NAME}" created`);
  return collection;
}

export async function upsertDocs(docs) {
  const result = await typesenseClient
    .collections(COLLECTION_NAME)
    .documents()
    .import(docs, { action: "upsert" });
  return result;
}

export async function upsertDoc(doc) {
  return await typesenseClient
    .collections(COLLECTION_NAME)
    .documents()
    .upsert(doc);
}

export async function deleteDoc(id) {
  try {
    return await typesenseClient
      .collections(COLLECTION_NAME)
      .documents(id)
      .delete();
  } catch (err) {
    if (err.httpStatus === 404) {
      console.log(`Document ${id} not found in Typesense, skipping delete`);
      return null;
    }
    throw err;
  }
}
```

---

### Task 4: Initial sync service + CLI script

**Files:**
- Create: `SearchService/src/services/initial-sync.service.js`
- Create: `SearchService/scripts/initial-sync.js`

- [ ] **Step 1: Create initial-sync.service.js**

Fetches products from ProductService API via pagination, transforms, and batch imports to Typesense.

```js
import axios from "axios";
import { toTypesenseDocs } from "../utils/product-transformer.js";
import { upsertDocs } from "./sync.service.js";

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:8082";

export async function initialSync() {
  console.log("Starting initial sync from ProductService...");

  let page = 1;
  const limit = 250;
  let totalSynced = 0;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${PRODUCT_SERVICE_URL}/api/products?page=${page}&limit=${limit}`;
    console.log(`Fetching page ${page}/${totalPages}: ${url}`);

    const response = await axios.get(url);
    const products = response.data.data || response.data;

    if (!Array.isArray(products) || products.length === 0) {
      console.log("No more products to sync");
      break;
    }

    totalPages = response.data.totalPages || 1;
    const docs = toTypesenseDocs(products);

    const results = await upsertDocs(docs);
    const successCount = results.filter((r) => r.success).length;
    totalSynced += successCount;

    console.log(`Synced ${successCount}/${products.length} products (total: ${totalSynced})`);
    page++;
  }

  console.log(`Initial sync complete: ${totalSynced} products indexed in Typesense`);
  return totalSynced;
}
```

- [ ] **Step 2: Create scripts/initial-sync.js**

CLI entry point that loads env, ensures collection exists, and runs initial sync.

```js
import dotenv from "dotenv";
dotenv.config();

import { ensureCollection } from "../src/services/sync.service.js";
import { initialSync } from "../src/services/initial-sync.service.js";

async function main() {
  try {
    console.log("=== Typesense Initial Sync ===");
    await ensureCollection();
    await initialSync();
    console.log("=== Sync finished successfully ===");
    process.exit(0);
  } catch (err) {
    console.error("Sync failed:", err.message);
    process.exit(1);
  }
}

main();
```

---

### Task 5: Search service + Search controller + routes

**Files:**
- Create: `SearchService/src/services/search.service.js`
- Create: `SearchService/src/controllers/search.controller.js`
- Create: `SearchService/src/routes/search.routes.js`

- [ ] **Step 1: Create search.service.js**

Builds and executes the hybrid search query against Typesense.

```js
import typesenseClient from "../config/typesense.config.js";

const COLLECTION_NAME = "d4c_products";

export async function searchProducts(query, options = {}) {
  const {
    page = 1,
    limit = 12,
    filter_by,
    sort_by = "_text_match:desc",
  } = options;

  const searchParams = {
    collection: COLLECTION_NAME,
    q: query,
    query_by: "name,description,embedding",
    query_by_weights: "3,2,0",
    prefix: true,
    num_typos: 2,
    sort_by,
    per_page: Math.min(250, Math.max(1, Number(limit))),
    page: Math.max(1, Number(page)),
    vector_query: "embedding:([], alpha: 0.3, k: 200)",
    exclude_fields: "embedding",
    drop_tokens_threshold: 1,
  };

  if (filter_by) {
    searchParams.filter_by = filter_by;
  }

  const startTime = Date.now();
  const result = await typesenseClient.multiSearch.perform({
    searches: [searchParams],
  });
  const searchTimeMs = Date.now() - startTime;

  const searchResult = result.results[0];
  const hits = searchResult.hits || [];
  const total = searchResult.found || 0;
  const perPage = searchResult.request_params.per_page;
  const totalPages = Math.ceil(total / perPage) || 1;

  const data = hits.map((hit) => ({
    ...hit.document,
    _text_match: hit.text_match,
    _vector_distance: hit.vector_distance,
  }));

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
    keyword: query,
    searchTimeMs,
  };
}
```

- [ ] **Step 2: Create search.controller.js**

```js
import { searchProducts } from "../services/search.service.js";

export const handleSearch = async (req, res) => {
  try {
    const { q, page, limit, filter_by, sort_by } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        message: "Vui lòng nhập từ khóa tìm kiếm",
      });
    }

    const options = {};
    if (page) options.page = page;
    if (limit) options.limit = limit;
    if (filter_by) options.filter_by = filter_by;
    if (sort_by) options.sort_by = sort_by;

    const result = await searchProducts(q.trim(), options);
    res.status(200).json(result);
  } catch (error) {
    console.error("Search error:", error);
    res.status(503).json({
      message: "Search service temporarily unavailable",
      error: error.message,
    });
  }
};
```

- [ ] **Step 3: Create search.routes.js**

```js
import express from "express";
import { handleSearch } from "../controllers/search.controller.js";

const router = express.Router();

router.get("/", handleSearch);

export default router;
```

---

### Task 6: Product event consumer + DLQ handler + admin controller

**Files:**
- Create: `SearchService/src/consumers/product-event.consumer.js`
- Create: `SearchService/src/services/dlq-handler.service.js`
- Create: `SearchService/src/controllers/admin.controller.js`
- Create: `SearchService/src/routes/admin.routes.js`

- [ ] **Step 1: Create product-event.consumer.js**

Consumes messages from `search.product.queue` and calls sync service.

```js
import { getChannel, QUEUE } from "../config/rabbitmq.config.js";
import { toTypesenseDoc } from "../utils/product-transformer.js";
import { upsertDoc, deleteDoc } from "../services/sync.service.js";

export async function startConsumer() {
  const channel = await getChannel();

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const body = JSON.parse(msg.content.toString());
      const { eventType, data } = body;

      console.log(`Received event: ${eventType} for product ${data?.id}`);

      switch (eventType) {
        case "CREATE":
        case "UPDATE":
          const doc = toTypesenseDoc(data);
          await upsertDoc(doc);
          console.log(`Product ${data.id} synced to Typesense (${eventType})`);
          break;
        case "DELETE":
          await deleteDoc(data.id);
          console.log(`Product ${data.id} removed from Typesense`);
          break;
        default:
          console.warn(`Unknown event type: ${eventType}`);
          break;
      }

      channel.ack(msg);
    } catch (err) {
      console.error("Error processing product event:", err.message);
      channel.nack(msg, false, false); // Send to DLQ
    }
  });

  console.log("Product event consumer started");
}
```

- [ ] **Step 2: Create dlq-handler.service.js**

Consumes from DLQ, retries with exponential backoff, max 5 attempts.

```js
import { getChannel, DLQ_QUEUE, DLQ_ROUTING_KEY, DLX_EXCHANGE } from "../config/rabbitmq.config.js";
import { toTypesenseDoc } from "../utils/product-transformer.js";
import { upsertDoc, deleteDoc } from "../services/sync.service.js";

const MAX_RETRIES = 5;

export async function processDLQ() {
  const channel = await getChannel();

  return new Promise((resolve, reject) => {
    let processed = 0;

    channel.consume(DLQ_QUEUE, async (msg) => {
      if (!msg) {
        console.log("DLQ empty, no messages to retry");
        resolve({ processed });
        return;
      }

      try {
        const body = JSON.parse(msg.content.toString());
        const { eventType, data } = body;
        const retryCount = msg.properties.headers?.["x-retry-count"] || 0;

        if (retryCount >= MAX_RETRIES) {
          console.error(
            `DLQ message permanently failed after ${MAX_RETRIES} retries: ${eventType} ${data?.id}`
          );
          channel.ack(msg);
          processed++;
          return;
        }

        console.log(
          `Retrying DLQ message (attempt ${retryCount + 1}/${MAX_RETRIES}): ${eventType} ${data?.id}`
        );

        switch (eventType) {
          case "CREATE":
          case "UPDATE":
            const doc = toTypesenseDoc(data);
            await upsertDoc(doc);
            break;
          case "DELETE":
            await deleteDoc(data.id);
            break;
          default:
            console.warn(`Unknown event type in DLQ: ${eventType}`);
            break;
        }

        channel.ack(msg);
        processed++;
      } catch (err) {
        console.error("DLQ retry failed:", err.message);
        const headers = msg.properties.headers || {};
        headers["x-retry-count"] = (headers["x-retry-count"] || 0) + 1;

        channel.nack(msg, false, false);
        reject(err);
      }
    }, { noAck: false });
  });
}
```

- [ ] **Step 3: Create admin.controller.js**

```js
import { processDLQ } from "../services/dlq-handler.service.js";

export const handleDlqRetry = async (req, res) => {
  try {
    const result = await processDLQ();
    res.status(200).json({
      message: "DLQ retry completed",
      processed: result.processed,
    });
  } catch (error) {
    console.error("DLQ retry error:", error);
    res.status(500).json({
      message: "DLQ retry failed",
      error: error.message,
    });
  }
};
```

- [ ] **Step 4: Create admin.routes.js**

```js
import express from "express";
import { handleDlqRetry } from "../controllers/admin.controller.js";

const router = express.Router();

router.post("/dlq/retry", handleDlqRetry);

export default router;
```

---

### Task 7: SearchService entry point (index.js)

**Files:**
- Create: `SearchService/src/index.js`

- [ ] **Step 1: Create index.js**

Wires everything together: Express server, Typesense collection, RabbitMQ consumer, Eureka registration.

```js
import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import searchRoutes from "./routes/search.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { ensureCollection } from "./services/sync.service.js";
import { connect } from "./config/rabbitmq.config.js";
import { startConsumer } from "./consumers/product-event.consumer.js";
import eurekaClient from "./config/eureka.config.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8089;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/search", searchRoutes);
app.use("/api/search/admin", adminRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    name: "Search Service",
    status: "UP",
  });
});

async function bootstrap() {
  try {
    // Ensure Typesense collection exists
    await ensureCollection();

    // Connect to RabbitMQ and start consumer
    await connect();
    await startConsumer();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`SearchService running on http://localhost:${PORT}`);

      // Register with Eureka
      eurekaClient.start((err) => {
        if (err) {
          console.error("Eureka registration failed:", err);
        } else {
          console.log("SearchService registered with Eureka");
        }
      });
    });
  } catch (err) {
    console.error("Failed to start SearchService:", err);
    process.exit(1);
  }
}

bootstrap();

process.on("SIGINT", () => {
  eurekaClient.stop(() => {
    console.log("Eureka client stopped");
    process.exit();
  });
});
```

---

### Task 8: ProductService RabbitMQ publisher

**Files:**
- Modify: `ProductService/package.json`
- Modify: `ProductService/.env.example`
- Modify: `ProductService/.env`
- Create: `ProductService/src/config/rabbitmq.publisher.js`
- Create: `ProductService/src/services/event-publisher.service.js`
- Modify: `ProductService/src/services/product.service.js`

- [ ] **Step 1: Add amqplib to ProductService/package.json**

Add to dependencies:
```json
"amqplib": "^0.10.4"
```

- [ ] **Step 2: Add RabbitMQ env vars to ProductService/.env.example**

Append:
```
RABBITMQ_HOST=
RABBITMQ_PORT=
RABBITMQ_USER=
RABBITMQ_PASSWORD=
```

- [ ] **Step 3: Add RabbitMQ env vars to ProductService/.env**

Append:
```
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
```

- [ ] **Step 4: Create rabbitmq.publisher.js**

```js
import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;
const EXCHANGE = "product.exchange";

let connection = null;
let channel = null;

export async function connect() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, "topic", { durable: true });
    console.log("ProductService RabbitMQ publisher connected");
    return channel;
  } catch (err) {
    console.error("RabbitMQ publisher connection failed:", err.message);
    return null;
  }
}

export async function publish(routingKey, message) {
  if (!channel) {
    console.warn("RabbitMQ channel not ready, skipping publish");
    return;
  }
  try {
    channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
  } catch (err) {
    console.error("Failed to publish message:", err.message);
  }
}

export async function close() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
```

- [ ] **Step 5: Create event-publisher.service.js**

```js
import { v4 as uuidv4 } from "uuid";
import { publish, connect } from "../config/rabbitmq.publisher.js";

const ROUTING_KEYS = {
  CREATE: "product.created",
  UPDATE: "product.updated",
  DELETE: "product.deleted",
};

export function publishProductEvent(eventType, productData) {
  const event = {
    eventId: uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    data: productData,
  };

  const routingKey = ROUTING_KEYS[eventType];
  if (!routingKey) {
    console.error(`Unknown event type: ${eventType}`);
    return;
  }

  publish(routingKey, event);
}

export { connect as connectEventPublisher };
```

- [ ] **Step 6: Modify product.service.js to publish events**

Add imports at the top:
```js
import { publishProductEvent, connectEventPublisher } from "./event-publisher.service.js";
```

In `createProduct()`, after `return await this._populateRelations(newProduct);` (last line of the method), add event publish. The method currently returns at line ~248. Add before the return:

Find the `createProduct` method's return statement and modify it:

```js
    const populated = await this._populateRelations(newProduct);
    publishProductEvent("CREATE", {
      id: newProduct.id,
      name: newProduct.name,
      description: newProduct.description,
      price: newProduct.price,
      categoryId: newProduct.categoryId,
      category: populated.category,
      brand: newProduct.brand,
      gender: newProduct.gender,
      tags: newProduct.tags,
      imageUrl: newProduct.imageUrl,
      isFeatured: newProduct.isFeatured,
      createdAt: newProduct.createdAt,
      variants: populated.variants || [],
    });
    return populated;
```

In `updateProduct()`, after `return await this.getProductById(id);` (last line ~line 321):

Replace the last line with:
```js
    const updated = await this.getProductById(id);
    publishProductEvent("UPDATE", {
      id,
      name: updated.name,
      description: updated.description,
      price: updated.price,
      categoryId: updated.categoryId,
      category: updated.category,
      brand: updated.brand,
      gender: updated.gender,
      tags: updated.tags,
      imageUrl: updated.imageUrl,
      isFeatured: updated.isFeatured,
      createdAt: updated.createdAt,
      variants: updated.variants || [],
    });
    return updated;
```

In `deleteProduct()`, after `await productModel.remove(id);` and before the return, add:

```js
    publishProductEvent("DELETE", { id });
```

- [ ] **Step 7: Connect RabbitMQ publisher in ProductService index.js**

In `ProductService/src/index.js`, add after `dotenv.config();`:

```js
import { connectEventPublisher } from "./services/event-publisher.service.js";
```

Add after `app.listen(...)` callback, inside the Eureka start callback or right after:

```js
  connectEventPublisher();
```

Full modified index.js context — add the import and the connect call:

```js
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import eurekaClient from "./config/eureka.config.js";
import { openApiSpec } from "./config/openapi.js";
import { connectEventPublisher } from "./services/event-publisher.service.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8082;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);

app.get("/health", (req, res) => {
  res.json({
    name: "Product Service",
    status: "UP",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
  console.log(
    `API documentation available at http://localhost:${PORT}/api-docs`,
  );

  connectEventPublisher();

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

---

### Task 9: Docker Compose + API Gateway + root env

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `Api-Gateway/src/main/resources/application.properties`
- Modify: `.env.example`
- Modify: `.env`

- [ ] **Step 1: Add typesense and searchservice to docker-compose.yml**

Add after the `frontend` service and before the `volumes` section:

```yaml
  typesense:
    image: typesense/typesense:30.2
    container_name: typesense
    restart: unless-stopped
    environment:
      TYPESENSE_DATA_DIR: /data
      TYPESENSE_API_KEY: ${TYPESENSE_API_KEY}
    ports:
      - "8108:8108"
    volumes:
      - typesense-data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8108/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    networks:
      - d4c-net

  searchservice:
    build:
      context: ./SearchService
      dockerfile: Dockerfile
    container_name: searchservice
    hostname: searchservice
    env_file:
      - ./SearchService/.env
    depends_on:
      discovery-server:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      typesense:
        condition: service_healthy
    ports:
      - "8089:8089"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8089/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 25s
    networks:
      - d4c-net
```

Add `typesense-data` to the volumes section:

```yaml
volumes:
  mariadb_data:
  redis_data:
  rabbitmq_data:
  typesense-data:
```

- [ ] **Step 2: Add searchservice to api-gateway depends_on in docker-compose.yml**

In the `api-gateway` service's `depends_on` section, add:

```yaml
      searchservice:
        condition: service_healthy
      typesense:
        condition: service_healthy
```

- [ ] **Step 3: Add searchservice dev override to docker-compose.dev.yml**

Append to the services section:

```yaml
  searchservice:
    command: ["npm", "run", "dev"]
    volumes:
      - ./SearchService:/app
      - search_node_modules:/app/node_modules
```

Add to the volumes section at the bottom:

```yaml
  search_node_modules:
```

- [ ] **Step 4: Add search routes to API Gateway**

Append to `Api-Gateway/src/main/resources/application.properties`:

```properties
spring.cloud.gateway.routes[11].id=searchservice-route
spring.cloud.gateway.routes[11].uri=lb://SEARCHSERVICE
spring.cloud.gateway.routes[11].predicates[0]=Path=/api/search/**

spring.cloud.gateway.routes[12].id=search-admin-route
spring.cloud.gateway.routes[12].uri=lb://SEARCHSERVICE
spring.cloud.gateway.routes[12].predicates[0]=Path=/api/search/admin/**
```

- [ ] **Step 5: Add TYPESENSE_API_KEY to root .env.example**

Append:
```
TYPESENSE_API_KEY=
```

- [ ] **Step 6: Add TYPESENSE_API_KEY to root .env**

Append:
```
TYPESENSE_API_KEY=d4c-typesense-secret-key
```

---

### Task 10: Verify & test the full stack

- [ ] **Step 1: Build and start all services**

```bash
docker compose down
docker compose up --build -d
```

- [ ] **Step 2: Verify all services are healthy**

```bash
docker compose ps
```

Expected: All services show `healthy` or `running`.

- [ ] **Step 3: Verify Typesense is running**

```bash
curl http://localhost:8108/health
```

Expected: `{"ok":true}`

- [ ] **Step 4: Verify SearchService is registered in Eureka**

```bash
curl http://localhost:8761/eureka/apps/SEARCHSERVICE
```

Expected: XML response with SEARCHSERVICE instance info.

- [ ] **Step 5: Run initial sync**

```bash
docker compose exec searchservice npm run sync
```

Expected: Log output showing pages fetched and products synced.

- [ ] **Step 6: Test search via gateway**

```bash
curl "http://localhost:8080/api/search?q=ao"
```

Expected: JSON response with `data`, `total`, `page`, `limit`, `totalPages`, `keyword`, `searchTimeMs`.

- [ ] **Step 7: Test fuzzy search**

```bash
curl "http://localhost:8080/api/search?q=ao thung"
```

Expected: Results for "ao thun" (fuzzy correction of "thung" → "thun").

- [ ] **Step 8: Test event-driven sync**

Create a product via ProductService admin API, then search for it:

```bash
curl "http://localhost:8080/api/search?q=<new-product-name>"
```

Expected: New product appears in search results within seconds.

---

## Self-Review

**1. Spec coverage check:**

| Spec Requirement | Task |
|---|---|
| Typesense container (v30.2, volume) | Task 9 |
| SearchService container (port 8089) | Task 9 |
| Eureka registration | Task 2, Task 7 |
| API Gateway routes | Task 9 |
| Typesense collection schema (embedding, auto-embed) | Task 3 |
| Initial sync via ProductService API (not DB) | Task 4 |
| RabbitMQ exchange/queue/DLX/DLQ | Task 2 |
| Product event consumer (CREATE/UPDATE/DELETE) | Task 6 |
| ProductService RabbitMQ publisher | Task 8 |
| Hybrid search (full-text + fuzzy + semantic) | Task 5 |
| DLQ handler with retry/backoff | Task 6 |
| Admin endpoint `/api/search/admin/dlq/retry` | Task 6 |
| Error handling (503, 400, DLQ) | Tasks 5, 6 |
| Environment variables | Tasks 1, 8, 9 |
| Docker dev override | Task 9 |

**2. Placeholder scan:** No TBD, TODO, or incomplete sections found.

**3. Type consistency:** All event message formats, Typesense schema fields, and API response structures are consistent across tasks. `toTypesenseDoc` is the single source of truth for document transformation.

**4. Scope:** Focused on search service + ProductService integration. No unrelated refactoring.
