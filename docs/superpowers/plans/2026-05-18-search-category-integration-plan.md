# SearchService Category Integration & Dynamic Filter Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\- [ ]\) syntax for tracking.

**Goal:** Integrate category search into SearchService via Typesense + RabbitMQ sync, and fix the broken URL facet filtering with a Dynamic Filter Builder.

**Architecture:** Two independent features within SearchService: (1) A new \d4c_categories\ Typesense collection synced from ProductService category events via RabbitMQ, with a dedicated search endpoint; (2) A filter builder that parses \size\, \color\, \category\, \rand\, \price\ query params into Typesense \ilter_by\ expressions.

**Tech Stack:** Node.js/Express, Typesense, RabbitMQ (amqplib), Eureka

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| \SearchService/src/services/sync.service.js\ | Modify | Add \ensureCategoryCollection()\, \upsertCategoryDoc()\, \deleteCategoryDoc()\, add \sizes\/\colors\ to product schema |
| \SearchService/src/utils/product-transformer.js\ | Modify | Add \sizes\/\colors\ flattening to \	oTypesenseDoc()\ |
| \SearchService/src/utils/category-transformer.js\ | Create | Unwrap category event envelope into Typesense document |
| \SearchService/src/utils/event-processor.js\ | Modify | Route \CATEGORY_CREATED/UPDATED/DELETED\ events to category handlers |
| \SearchService/src/config/rabbitmq.config.js\ | Modify | Add category queue, bindings, DLQ routing key constants, \setupCategoryQueue()\ |
| \SearchService/src/consumers/category-event.consumer.js\ | Create | Consumes from \search.category.queue\ |
| \SearchService/src/services/category.service.js\ | Create | Typesense query builder for category search |
| \SearchService/src/controllers/category.controller.js\ | Create | Request handler for \GET /api/search/categories\ |
| \SearchService/src/routes/category.routes.js\ | Create | Route definitions for category search |
| \SearchService/src/services/search.service.js\ | Modify | Add \uildFilterString()\ function (exported) |
| \SearchService/src/controllers/search.controller.js\ | Modify | Extract all filter params, use \uildFilterString()\ |
| \SearchService/src/index.js\ | Modify | Bootstrap category collection, register category routes, start category consumer |
| \ProductService/src/services/event-publisher.service.js\ | Modify | Add \publishCategoryEvent()\ function |
| \ProductService/src/controllers/category.controller.js\ | Modify | Publish events after CRUD operations |

---

### Task 1: Add \sizes\ and \colors\ fields to \d4c_products\ schema + flatten variants

**Files:**
- Modify: \SearchService/src/services/sync.service.js\
- Modify: \SearchService/src/utils/product-transformer.js\

- [ ] **Step 1: Add \sizes\ and \colors\ fields to COLLECTION_SCHEMA**

In \SearchService/src/services/sync.service.js\, add these two fields to the \ields\ array in \COLLECTION_SCHEMA\ (place them after the \	ags\ field, before \imageUrl\):

\\\javascript
    { name: \"sizes\", type: \"string[]\", facet: true, optional: true },
    { name: \"colors\", type: \"string[]\", facet: true, optional: true },
\\\

- [ ] **Step 2: Update \	oTypesenseDoc()\ to flatten variants**

In \SearchService/src/utils/product-transformer.js\, add these two lines right after the \ariants: product.variants || [],\ line in the return object:

\\\javascript
    sizes: (product.variants || []).map((v) => v.size).filter(Boolean),
    colors: (product.variants || []).map((v) => v.color).filter(Boolean),
\\\

---

### Task 2: Add \ensureCategoryCollection()\ and category CRUD helpers to sync.service.js

**Files:**
- Modify: \SearchService/src/services/sync.service.js\

- [ ] **Step 1: Append category collection schema and ensure function**

Append to the end of \SearchService/src/services/sync.service.js\:

\\\javascript
const CATEGORY_COLLECTION_NAME = \"d4c_categories\";

const CATEGORY_COLLECTION_SCHEMA = {
  name: CATEGORY_COLLECTION_NAME,
  fields: [
    { name: \"id\", type: \"string\" },
    { name: \"name\", type: \"string\", locale: \"vi\", facet: true },
    { name: \"description\", type: \"string\", locale: \"vi\", optional: true },
    { name: \"imageUrl\", type: \"string\", index: false, optional: true },
    { name: \"createdAt\", type: \"int64\" },
    { name: \"updatedAt\", type: \"int64\" },
  ],
  default_sorting_field: \"createdAt\",
};

export async function ensureCategoryCollection() {
  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const collections = await typesenseClient.collections().retrieve();
      const exists = collections.find((c) => c.name === CATEGORY_COLLECTION_NAME);

      if (exists) {
        console.log(\Dropping existing collection \"\\" to recreate...\);
        await typesenseClient.collections(CATEGORY_COLLECTION_NAME).delete();
      }

      const collection = await typesenseClient.collections().create(CATEGORY_COLLECTION_SCHEMA);
      console.log(\Typesense collection \"\\" created\);
      return collection;
    } catch (err) {
      if (err.httpStatus === 503 && attempt < maxRetries) {
        console.log(\Typesense not ready for categories (attempt \/\), retrying in \ms...\);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
      if (err.httpStatus === 409 && attempt < maxRetries) {
        console.log(\Category collection already exists (race condition), retrying...\);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
}

export async function upsertCategoryDoc(doc) {
  return await typesenseClient
    .collections(CATEGORY_COLLECTION_NAME)
    .documents()
    .upsert(doc);
}

export async function deleteCategoryDoc(id) {
  try {
    return await typesenseClient
      .collections(CATEGORY_COLLECTION_NAME)
      .documents(id)
      .delete();
  } catch (err) {
    if (err.httpStatus === 404) {
      console.log(\Category document \ not found in Typesense, skipping delete\);
      return null;
    }
    throw err;
  }
}
\\\

---

### Task 3: Create category-transformer.js

**Files:**
- Create: \SearchService/src/utils/category-transformer.js\

- [ ] **Step 1: Create the file**

\\\javascript
export function toCategoryTypesenseDoc(eventData) {
  return {
    id: eventData.id,
    name: eventData.name || \"\",
    description: eventData.description || \"\",
    imageUrl: eventData.imageUrl || \"\",
    createdAt: eventData.createdAt
      ? (() => {
          const ts = Date.parse(eventData.createdAt);
          return Number.isFinite(ts) ? Math.floor(ts / 1000) : 0;
        })()
      : 0,
    updatedAt: eventData.updatedAt
      ? (() => {
          const ts = Date.parse(eventData.updatedAt);
          return Number.isFinite(ts) ? Math.floor(ts / 1000) : 0;
        })()
      : 0,
  };
}
\\\

---

### Task 4: Update event-processor.js for category events

**Files:**
- Modify: \SearchService/src/utils/event-processor.js\

- [ ] **Step 1: Replace entire file content**

\\\javascript
import { toTypesenseDoc } from \"./product-transformer.js\";
import { toCategoryTypesenseDoc } from \"./category-transformer.js\";
import { upsertDoc, deleteDoc, upsertCategoryDoc, deleteCategoryDoc } from \"../services/sync.service.js\";

export async function processEvent(eventType, data) {
  switch (eventType) {
    case \"CREATE\":
    case \"UPDATE\":
      const doc = toTypesenseDoc(data);
      await upsertDoc(doc);
      console.log(\Product \ synced to Typesense (\)\);
      break;
    case \"DELETE\":
      await deleteDoc(data.id);
      console.log(\Product \ removed from Typesense\);
      break;
    case \"CATEGORY_CREATED\":
    case \"CATEGORY_UPDATED\":
      const catDoc = toCategoryTypesenseDoc(data);
      await upsertCategoryDoc(catDoc);
      console.log(\Category \ synced to Typesense (\)\);
      break;
    case \"CATEGORY_DELETED\":
      await deleteCategoryDoc(data.id);
      console.log(\Category \ removed from Typesense\);
      break;
    default:
      console.warn(\Unknown event type: \\);
      break;
  }
}
\\\

---

### Task 5: Add category queue configuration to rabbitmq.config.js

**Files:**
- Modify: \SearchService/src/config/rabbitmq.config.js\

- [ ] **Step 1: Add category constants after existing exports**

After the existing \ROUTING_KEYS\ export, add:

\\\javascript
export const CATEGORY_QUEUE = \"search.category.queue\";
export const CATEGORY_DLQ_ROUTING_KEY = \"category.failed\";
export const CATEGORY_ROUTING_KEYS = {
  CREATE: \"category.created\",
  UPDATE: \"category.updated\",
  DELETE: \"category.deleted\",
};
\\\

- [ ] **Step 2: Add \setupCategoryQueue()\ function before \close()\**

\\\javascript
export async function setupCategoryQueue() {
  await channel.assertQueue(CATEGORY_QUEUE, {
    durable: true,
    arguments: {
      \"x-queue-type\": \"quorum\",
      \"x-dead-letter-exchange\": DLX_EXCHANGE,
      \"x-dead-letter-routing-key\": CATEGORY_DLQ_ROUTING_KEY,
      \"x-message-ttl\": 300000,
    },
  });

  await channel.bindQueue(CATEGORY_QUEUE, EXCHANGE, CATEGORY_ROUTING_KEYS.CREATE);
  await channel.bindQueue(CATEGORY_QUEUE, EXCHANGE, CATEGORY_ROUTING_KEYS.UPDATE);
  await channel.bindQueue(CATEGORY_QUEUE, EXCHANGE, CATEGORY_ROUTING_KEYS.DELETE);

  console.log(\"Category queue and bindings declared\");
}
\\\

- [ ] **Step 3: Call \setupCategoryQueue()\ in \connect()\**

Add \wait setupCategoryQueue();\ right before the final \console.log(\"RabbitMQ connected, exchange and queues declared\");\ line in the \connect()\ function.

---

### Task 6: Create category-event.consumer.js

**Files:**
- Create: \SearchService/src/consumers/category-event.consumer.js\

- [ ] **Step 1: Create the file**

\\\javascript
import { getChannel, CATEGORY_QUEUE } from \"../config/rabbitmq.config.js\";
import { processEvent } from \"../utils/event-processor.js\";

export async function startCategoryConsumer() {
  const channel = await getChannel();

  channel.consume(CATEGORY_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const body = JSON.parse(msg.content.toString());
      const { eventType, data } = body;

      console.log(\Received category event: \ for category \\);

      await processEvent(eventType, data);
      channel.ack(msg);
    } catch (err) {
      console.error(\"Error processing category event:\", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log(\"Category event consumer started\");
}
\\\

---

### Task 7: Create category.service.js

**Files:**
- Create: \SearchService/src/services/category.service.js\

- [ ] **Step 1: Create the file**

\\\javascript
import typesenseClient from \"../config/typesense.config.js\";

const COLLECTION_NAME = \"d4c_categories\";

export async function searchCategories(options = {}) {
  const {
    q = \"*\",
    page = 1,
    limit = 20,
    sort_by = \"createdAt:desc\",
  } = options;

  const searchParams = {
    collection: COLLECTION_NAME,
    q: q,
    query_by: \"name,description\",
    page: Math.max(1, Number(page)),
    per_page: Math.min(100, Math.max(1, Number(limit))),
    sort_by: sort_by,
  };

  const startTime = Date.now();
  const result = await typesenseClient.multiSearch.perform({
    searches: [searchParams],
  });
  const searchTimeMs = Date.now() - startTime;

  const searchResult = result.results[0];
  const hits = searchResult.hits || [];
  const total = searchResult.found || 0;
  const perPage = searchResult.request_params?.per_page || searchParams.per_page;
  const totalPages = Math.ceil(total / perPage) || 1;

  const data = hits.map((hit) => ({
    ...hit.document,
    _text_match: hit.text_match,
  }));

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
    keyword: q === \"*\" ? \"\" : q,
    searchTimeMs,
  };
}
\\\

---

### Task 8: Create category.controller.js

**Files:**
- Create: \SearchService/src/controllers/category.controller.js\

- [ ] **Step 1: Create the file**

\\\javascript
import { searchCategories } from \"../services/category.service.js\";

export const handleCategorySearch = async (req, res) => {
  try {
    const { q, page, limit, sort_by } = req.query;

    const options = {};
    if (q && q.trim() !== \"\") options.q = q.trim();
    if (page) options.page = page;
    if (limit) options.limit = limit;
    if (sort_by) options.sort_by = sort_by;

    const result = await searchCategories(options);
    res.status(200).json(result);
  } catch (error) {
    console.error(\"Category search error:\", error);
    res.status(503).json({
      message: \"Category search service temporarily unavailable\",
    });
  }
};
\\\

---

### Task 9: Create category.routes.js and register in index.js

**Files:**
- Create: \SearchService/src/routes/category.routes.js\
- Modify: \SearchService/src/index.js\

- [ ] **Step 1: Create category.routes.js**

\\\javascript
import express from \"express\";
import { handleCategorySearch } from \"../controllers/category.controller.js\";

const router = express.Router();

router.get(\"/\", handleCategorySearch);

export default router;
\\\

- [ ] **Step 2: Register category routes in index.js**

Add import at the top:
\\\javascript
import categoryRoutes from \"./routes/category.routes.js\";
\\\

Add route registration after \pp.use(\"/api/search\", searchRoutes);\:
\\\javascript
app.use(\"/api/search/categories\", categoryRoutes);
\\\

---

### Task 10: Add \uildFilterString()\ to search.service.js

**Files:**
- Modify: \SearchService/src/services/search.service.js\

- [ ] **Step 1: Add the function (exported) after imports, before \searchProducts\**

\\\javascript
export function buildFilterString(query) {
  const filters = [];

  if (query.filter_by) {
    filters.push(query.filter_by);
  }

  if (query.category) {
    const cats = Array.isArray(query.category) ? query.category : [query.category];
    const catExpr = cats.map((c) => \category:=\"\\"\).join(\" || \");
    filters.push(catExpr);
  }

  if (query.brand) {
    const brands = Array.isArray(query.brand) ? query.brand : [query.brand];
    const brandExpr = brands.map((b) => \rand:=\"\\"\).join(\" || \");
    filters.push(brandExpr);
  }

  if (query.priceMin !== undefined && query.priceMin !== \"\") {
    const minVal = Number(query.priceMin);
    if (!Number.isNaN(minVal)) {
      filters.push(\price:>=\\);
    }
  }

  if (query.priceMax !== undefined && query.priceMax !== \"\") {
    const maxVal = Number(query.priceMax);
    if (!Number.isNaN(maxVal)) {
      filters.push(\price:<=\\);
    }
  }

  if (query.size) {
    const sizes = Array.isArray(query.size) ? query.size : [query.size];
    const sizeExpr = sizes.map((s) => \sizes:=\"\\"\).join(\" || \");
    filters.push(sizeExpr);
  }

  if (query.color) {
    const colors = Array.isArray(query.color) ? query.color : [query.color];
    const colorExpr = colors.map((c) => \colors:=\"\\"\).join(\" || \");
    filters.push(colorExpr);
  }

  return filters.length > 0 ? filters.join(\" && \") : undefined;
}
\\\

---

### Task 11: Update search.controller.js to use buildFilterString

**Files:**
- Modify: \SearchService/src/controllers/search.controller.js\

- [ ] **Step 1: Replace entire file content**

\\\javascript
import { searchProducts, buildFilterString } from \"../services/search.service.js\";

export const handleSearch = async (req, res) => {
  try {
    const { q, page, limit, filter_by, sort_by, category, brand, priceMin, priceMax, size, color } = req.query;

    if (!q || q.trim() === \"\") {
      return res.status(400).json({
        message: \"Vui long nhap tu khoa tim kiem\",
      });
    }

    const dynamicFilter = buildFilterString({
      filter_by,
      category,
      brand,
      priceMin,
      priceMax,
      size,
      color,
    });

    const options = {};
    if (page) options.page = page;
    if (limit) options.limit = limit;
    options.filter_by = dynamicFilter || filter_by;
    if (sort_by) options.sort_by = sort_by;

    const result = await searchProducts(q.trim(), options);
    res.status(200).json(result);
  } catch (error) {
    console.error(\"Search error:\", error);
    res.status(503).json({
      message: \"Search service temporarily unavailable\",
    });
  }
};
\\\

---

### Task 12: Update index.js bootstrap sequence

**Files:**
- Modify: \SearchService/src/index.js\

- [ ] **Step 1: Add imports and bootstrap calls**

Add these imports at the top:
\\\javascript
import { ensureCategoryCollection } from \"./services/sync.service.js\";
import { startCategoryConsumer } from \"./consumers/category-event.consumer.js\";
import categoryRoutes from \"./routes/category.routes.js\";
\\\

In \ootstrap()\, add after \wait ensureCollection();\:
\\\javascript
    await ensureCategoryCollection();
\\\

After \wait startConsumer();\:
\\\javascript
    await startCategoryConsumer();
\\\

After \pp.use(\"/api/search\", searchRoutes);\:
\\\javascript
app.use(\"/api/search/categories\", categoryRoutes);
\\\

---

### Task 13: Add category event publishing to ProductService

**Files:**
- Modify: \ProductService/src/services/event-publisher.service.js\
- Modify: \ProductService/src/controllers/category.controller.js\

- [ ] **Step 1: Append to event-publisher.service.js**

\\\javascript
const CATEGORY_ROUTING_KEYS = {
  CREATE: \"category.created\",
  UPDATE: \"category.updated\",
  DELETE: \"category.deleted\",
};

export function publishCategoryEvent(eventType, categoryData) {
  const event = {
    eventId: uuidv4(),
    eventType: \CATEGORY_\\,
    timestamp: new Date().toISOString(),
    data: categoryData,
  };

  const routingKey = CATEGORY_ROUTING_KEYS[eventType];
  if (!routingKey) {
    console.error(\Unknown category event type: \\);
    return;
  }

  publish(routingKey, event);
}
\\\

- [ ] **Step 2: Update category.controller.js**

Add import at top:
\\\javascript
import { publishCategoryEvent } from \"../services/event-publisher.service.js\";
\\\

Replace the three controller methods:

\\\javascript
export const createCategory = async (req, res) => {
  try {
    const data = req.body;
    const file = req.file;
    const newCategory = await categoryService.createCategory(data, file);
    publishCategoryEvent(\"CREATE\", newCategory);
    res.status(201).json(newCategory);
  } catch (error) {
    console.error(\"Error creating category:\", error);
    res.status(500).json({ message: \"Server error\", error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const file = req.file;
    const updated = await categoryService.updateCategory(id, data, file);
    publishCategoryEvent(\"UPDATE\", updated);
    res.status(200).json(updated);
  } catch (error) {
    console.error(\"Error updating category:\", error);
    if (error.message === \"Category not found\") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: \"Server error\", error: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await categoryService.deleteCategory(id);
    publishCategoryEvent(\"DELETE\", { id });
    res.status(200).json(result);
  } catch (error) {
    console.error(\"Error deleting category:\", error);
    if (error.message === \"Category not found\") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes(\"associated with it\")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: \"Server error\", error: error.message });
  }
};
\\\

---

### Task 14: Manual Verification

- [ ] **Step 1: Start full stack**

\\\ash
docker compose up --build -d
docker compose ps
\\\

- [ ] **Step 2: Verify category search**

\\\ash
curl \"http://localhost:8080/api/search/categories\"
curl \"http://localhost:8080/api/search/categories?q=ao\"
\\\

- [ ] **Step 3: Verify product search with filters**

\\\ash
curl \"http://localhost:8080/api/search?q=ao&size=XL&category=Ao\"
\\\

- [ ] **Step 4: Verify category event sync**

\\\ash
curl -X POST http://localhost:8080/api/categories -H \"Content-Type: application/json\" -d '{\"name\":\"Test Cat\",\"description\":\"Test\"}'
sleep 3
curl \"http://localhost:8080/api/search/categories?q=test\"
\\\

---

## Spec Coverage Checklist

| Spec Section | Task |
|-------------|------|
| 2. Typesense Schema: d4c_categories | Task 2 |
| 3. RabbitMQ Configuration | Task 5, Task 6 |
| 4. Category Search Endpoint | Task 7, Task 8, Task 9 |
| 5. Dynamic Filter Builder | Task 10, Task 11 |
| 6. Product Schema Update (sizes/colors) | Task 1 |
| 7. ProductService Category Events | Task 13 |
| 9. Error Handling | Built into each task |
| 11. Migration Steps | Tasks 1-14 |

## Placeholder Scan

No TBDs, TODOs, or placeholders. All code is complete.

## Type Consistency Check

- \uildFilterString\ exported from \search.service.js\, imported in \search.controller.js\
- \processEvent\ handles both product events (CREATE/UPDATE/DELETE) and category events (CATEGORY_CREATED/UPDATED/DELETED)
- \	oCategoryTypesenseDoc\ expects \data\ field from envelope
- Collection names: \d4c_products\, \d4c_categories\
- RabbitMQ constants consistent across config and consumers
