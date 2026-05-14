# Extract RecommendationService from ProductService

## Goal

Separate the recommendation system (behavior recording + personalized product recommendations) from the ProductService into a standalone `RecommendationService` Node.js microservice. Frontend stays untouched.

## Architecture

```
API Gateway (8080)
     │
     ├── /api/products/**        → lb://PRODUCTSERVICE
     ├── /api/behaviors/**       → lb://RECOMMENDATIONSERVICE  (changed)
     └── /api/recommendations/** → lb://RECOMMENDATIONSERVICE  (changed)

PRODUCTSERVICE (8082)                    RECOMMENDATIONSERVICE (8086)
  Express + ES Modules                     Express + ES Modules
  d4c_products (read/write)                d4c_user_behaviors (write)
  d4c_categories                           d4c_user_scores (read/write)
  d4c_variants                             d4c_products (read-only)
  S3 (images)

                  AWS DynamoDB (shared)
```

- RecommendationService registers with Eureka as `RECOMMENDATIONSERVICE`
- Both services share read access to `d4c_products` table
- No new infrastructure — same DynamoDB, same Eureka, same Docker network

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API paths | Keep same (`/api/behaviors`, `/api/recommendations`) | Zero frontend changes |
| Product data access | Direct DynamoDB read | No HTTP overhead, independent deploy |
| Service structure | Same as ProductService (Express + ES Modules) | Consistency in monorepo |
| Port | 8086 | Next available after 8085 (OrderService) |

## Files to Create

```
RecommendationService/
├── .dockerignore
├── .env.example
├── .env
├── .gitignore
├── Dockerfile
├── package.json
└── src/
    ├── index.js
    ├── config/
    │   ├── aws.config.js
    │   └── eureka.config.js
    ├── controllers/
    │   └── recommendation.controller.js
    ├── models/
    │   ├── behavior.model.js
    │   ├── product.model.js
    │   └── recommendation.model.js
    ├── routes/
    │   └── recommendation.routes.js
    └── services/
        └── recommendation.service.js
```

## Files to Modify

| File | Change |
|------|--------|
| `Api-Gateway/src/main/resources/application.properties` | Change `behavior-route` and `recommendation-route` target from `lb://PRODUCTSERVICE` to `lb://RECOMMENDATIONSERVICE` |
| `ProductService/src/index.js` | Remove behavior and recommendation route registrations |
| `docker-compose.yml` | Add `recommendationservice` service definition |
| `docker-compose.dev.yml` | Add dev overrides for recommendationservice |

## Files to Delete

| File | Reason |
|------|--------|
| `ProductService/src/controllers/recommendation.controller.js` | Moved |
| `ProductService/src/routes/recommendation.routes.js` | Moved |
| `ProductService/src/services/recommendation.service.js` | Moved |
| `ProductService/src/models/recommendation.model.js` | Moved |
| `ProductService/src/models/behavior.model.js` | Moved |

## Files NOT Changed

| File | Reason |
|------|--------|
| `frontend/src/services/productApi.ts` | Same API paths through gateway |
| `frontend/src/hooks/useProducts.ts` | Ditto |
| `frontend/src/pages/RecommendationsPage.tsx` | Ditto |
| `frontend/src/pages/Home.tsx` | Ditto |
| `frontend/src/pages/ProductDetail.tsx` | Ditto |
| `frontend/src/pages/CartPage.tsx` | Ditto |
| All other services | No dependency on recommendations |

## Code Changes Required

### recommendation.service.js

Replace calls to `productService` with direct `productModel` DynamoDB operations:

```
Before:  await productService.getProductById(id)
After:   await productModel.findById(id)

Before:  await productService.getAll({})
After:   await productModel.findAll()
```

### ProductService/src/index.js

Remove:
```js
import { behaviorRouter } from "./routes/recommendation.routes.js";
import { recommendationRouter } from "./routes/recommendation.routes.js";
// ...
app.use("/api/behaviors", behaviorRouter);
app.use("/api/recommendations", recommendationRouter);
```

## Verification

1. `docker compose up --build` — all services start, RecommendationService registers with Eureka
2. `GET http://localhost:8080/api/recommendations?userId=test&limit=4` — returns recommendations
3. `POST http://localhost:8080/api/behaviors` — records behavior event
4. Frontend: Home page recommended products still display, recommendations page works, behavior recording fires on product view/cart/buy
5. ProductService still serves products/categories/variants normally
