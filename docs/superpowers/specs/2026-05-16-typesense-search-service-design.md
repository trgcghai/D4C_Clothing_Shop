# Typesense Search Service — Design Spec

## Overview

Add a Typesense-powered search service to the D4C Clothing Shop microservices ecosystem, providing hybrid search (full-text + fuzzy + semantic) for products. The service is event-driven, syncing data from ProductService via RabbitMQ, and registers with Eureka for API Gateway routing.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Semantic search model | Built-in `ts/all-MiniLM-L12-v2` | Free, no external API, sufficient for clothing dataset |
| Embedded fields | `name` + `description` | Balance of semantic coverage vs indexing CPU |
| Initial sync | Script via ProductService API | Respects data isolation, no direct DB access |
| Resilience | DLQ handler + retry with backoff | Handles Typesense downtime gracefully |
| Service port | 8089 | Next available in sequence |
| Admin routes | `/api/search/admin/**` | Avoids conflict with existing `/api/admin/**` |

## Infrastructure

### New Docker Services

**typesense** (port 8108):
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
```

**searchservice** (port 8089):
```yaml
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

**New volume**: `typesense-data`

### API Gateway Routes

Append to `application.properties`:
```properties
spring.cloud.gateway.routes[11].id=searchservice-route
spring.cloud.gateway.routes[11].uri=lb://SEARCHSERVICE
spring.cloud.gateway.routes[11].predicates[0]=Path=/api/search/**

spring.cloud.gateway.routes[12].id=search-admin-route
spring.cloud.gateway.routes[12].uri=lb://SEARCHSERVICE
spring.cloud.gateway.routes[12].predicates[0]=Path=/api/search/admin/**
```

### RabbitMQ Exchange/Queue

| Component | Name | Type |
|---|---|---|
| Exchange | `product.exchange` | TopicExchange |
| Queue | `search.product.queue` | Quorum, durable, DLX |
| DLX | `product.search.dlx` | DirectExchange |
| DLQ | `product.search.dlq` | Quorum |
| Routing keys | `product.created`, `product.updated`, `product.deleted` | — |

Queue args:
- `x-queue-type`: `quorum`
- `x-dead-letter-exchange`: `product.search.dlx`
- `x-dead-letter-routing-key`: `dlq`
- `x-message-ttl`: `300000`

## Typesense Collection Schema

Collection name: `d4c_products`

```json
{
  "name": "d4c_products",
  "fields": [
    { "name": "id", "type": "string" },
    { "name": "name", "type": "string", "locale": "vi" },
    { "name": "description", "type": "string", "locale": "vi", "optional": true },
    { "name": "category", "type": "string", "facet": true, "optional": true },
    { "name": "brand", "type": "string", "facet": true, "optional": true },
    { "name": "gender", "type": "string", "facet": true, "optional": true },
    { "name": "price", "type": "float", "facet": true },
    { "name": "tags", "type": "string[]", "optional": true },
    { "name": "imageUrl", "type": "string", "index": false, "optional": true },
    { "name": "isFeatured", "type": "bool", "optional": true },
    { "name": "createdAt", "type": "int64" },
    { "name": "variants", "type": "object[]", "index": false, "optional": true },
    {
      "name": "embedding",
      "type": "float[]",
      "embed": {
        "from": ["name", "description"],
        "model_config": {
          "model_name": "ts/all-MiniLM-L12-v2"
        }
      }
    }
  ]
}
```

## Service Structure

```
SearchService/
├── src/
│   ├── config/
│   │   ├── typesense.config.js       # Typesense client init
│   │   ├── rabbitmq.config.js        # Connection, channel, exchange, queue, DLX setup
│   │   └── eureka.config.js          # Eureka registration
│   ├── controllers/
│   │   ├── search.controller.js      # GET /api/search
│   │   └── admin.controller.js       # POST /api/search/admin/dlq/retry
│   ├── services/
│   │   ├── search.service.js         # Hybrid query builder
│   │   ├── sync.service.js           # Typesense CRUD (upsert, delete)
│   │   ├── initial-sync.service.js   # Paginated fetch from ProductService API
│   │   └── dlq-handler.service.js    # DLQ consumer with retry/backoff
│   ├── consumers/
│   │   └── product-event.consumer.js # RabbitMQ message handler
│   ├── routes/
│   │   ├── search.routes.js
│   │   └── admin.routes.js
│   ├── utils/
│   │   └── product-transformer.js    # Product API → Typesense doc format
│   └── index.js                      # Entry point
├── scripts/
│   └── initial-sync.js               # npm run sync
├── .env.example
├── .env
├── Dockerfile
└── package.json
```

## Data Flows

### 1. Initialization Flow (Step 1.1–1.4)

1. Docker Compose starts: typesense → rabbitmq → discovery-server → searchservice
2. SearchService registers with Eureka as `SEARCHSERVICE:8089`
3. API Gateway picks up route via Eureka
4. **Initial sync** (one-time): `npm run sync`
   - Fetches `GET http://productservice:8082/api/products?page=1&limit=250` via Gateway
   - Paginates through all `totalPages`
   - Transforms each product via `product-transformer.js`
   - Batch inserts via Typesense `documents.import({ action: "upsert" })`
   - Logs: "Synced 150/1200 products..."

### 2. Write Flow — Event Driven Sync (Step 2.1–2.6)

1. Admin creates/updates/deletes product via CMS
2. ProductService commits to DynamoDB
3. ProductService publishes event to `product.exchange` with routing key `product.created` / `product.updated` / `product.deleted`
4. RabbitMQ routes to `search.product.queue`
5. SearchService consumer receives message:
   - `CREATE` / `UPDATE` → `sync.service.upsert(productData)`
   - `DELETE` → `sync.service.delete(productId)`
6. If Typesense unavailable → `nack` with requeue → DLQ after TTL expires
7. DLQ handler retries with exponential backoff (max 5 attempts)

**Event message format:**
```json
{
  "eventId": "uuid",
  "eventType": "CREATE" | "UPDATE" | "DELETE",
  "timestamp": "2026-05-16T...",
  "data": {
    "id": "product-uuid",
    "name": "Áo thun đi biển",
    "description": "Áo thun cotton thoáng mát...",
    "price": 250000,
    "categoryId": "cat-uuid",
    "category": "Áo thun",
    "brand": "D4C",
    "gender": "Unisex",
    "tags": ["biển", "mùa hè"],
    "imageUrl": "https://...",
    "isFeatured": false,
    "createdAt": 1715000000,
    "variants": [...]
  }
}
```

### 3. Read Flow — Hybrid Search (Step 3.1–3.4)

1. User types "áo thun đi biển" → frontend debounces 300ms
2. Request: `GET /api/search?q=áo thun đi biển&page=1&limit=12&filter_by=brand:D4C`
3. API Gateway routes to SearchService via Eureka
4. SearchService builds Typesense `multi_search` query:
   ```json
   {
     "searches": [{
       "collection": "d4c_products",
       "q": "áo thun đi biển",
       "query_by": "name,description,embedding",
       "query_by_weights": "3,2,0",
       "prefix": true,
       "num_typos": 2,
       "filter_by": "brand:D4C",
       "sort_by": "_text_match:desc",
       "per_page": 12,
       "page": 1,
       "vector_query": "embedding:([], alpha: 0.3, k: 200)",
       "exclude_fields": "embedding",
       "drop_tokens_threshold": 1
     }]
   }
   ```
5. Typesense returns results in <50ms
6. SearchService formats response:
   ```json
   {
     "data": [/* products with variants */],
     "total": 42,
     "page": 1,
     "limit": 12,
     "totalPages": 4,
     "keyword": "áo thun đi biển",
     "searchTimeMs": 23
   }
   ```

## API Endpoints

### Search Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/search` | Hybrid search products |

Query params: `q` (required), `page`, `limit`, `filter_by`, `sort_by`

### Admin Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/search/admin/dlq/retry` | Manually retry DLQ messages |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service health check |

## Error Handling

| Scenario | Behavior |
|---|---|
| Typesense down during sync | Reject message → RabbitMQ retries → DLQ after TTL |
| Typesense down during search | Return 503 `{ message: "Search service temporarily unavailable" }` |
| Empty search query | Return 400 `{ message: "Vui lòng nhập từ khóa tìm kiếm" }` |
| DLQ message permanently fails (5 retries) | Log error, ack, remove from DLQ |
| ProductService API unreachable during initial sync | Retry with exponential backoff (3 attempts), then fail |
| Invalid event message format | Log error, ack (skip malformed) |

## ProductService Changes

### Dependencies
Add to `ProductService/package.json`:
```json
"amqplib": "^0.10.4"
```

### New files
```
ProductService/src/
├── config/
│   └── rabbitmq.publisher.js    # Connection + publish helper
└── services/
    └── event-publisher.service.js # Publish product events
```

### Integration points
- `product.service.js:createProduct()` → publish `product.created`
- `product.service.js:updateProduct()` → publish `product.updated`
- `product.service.js:deleteProduct()` → publish `product.deleted`
- Non-blocking: fire-and-forget with error logging

## Environment Variables

### SearchService/.env.example
```
PORT=8089
SERVICE_NAME=SEARCHSERVICE
SERVICE_HOST=searchservice
EUREKA_SERVER_URL=http://discovery-server:8761/eureka
TYPESENSE_HOST=typesense
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=your-api-key
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
PRODUCT_SERVICE_URL=http://productservice:8082
```

### Root .env additions
```
TYPESENSE_API_KEY=d4c-typesense-secret-key
```

## Dependencies (SearchService)

```json
{
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

## Verify After Deployment

```bash
docker compose ps
curl http://localhost:8108/health                          # Typesense health
curl http://localhost:8089/health                          # SearchService health
curl http://localhost:8761                                 # Eureka dashboard (check SEARCHSERVICE)
curl "http://localhost:8080/api/search?q=ao+thun"          # Search via gateway
npm run sync --prefix SearchService                        # Initial sync
```
