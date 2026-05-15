# Repository Guidelines

## Architecture

This is a microservices monorepo with 10 application services, 1 API gateway, 1 service registry, and 3 infrastructure components, all orchestrated via Docker Compose.

| Service | Tech | Port | Build |
|---|---|---|---|
| DiscoveryServer | Spring Boot (Eureka) | 8761 | Gradle |
| Api-Gateway | Spring Cloud Gateway | 8080 | Gradle |
| UserService | Spring Boot (auth/users) | 8081 | Maven |
| ProductService | Node.js/Express + AWS DynamoDB/S3 | 8082 | npm |
| NotificationService | Spring Boot + RabbitMQ | 8083 | Gradle |
| CartService | Spring Boot + Redis | 8084 | Maven |
| OrderService | Spring Boot | 8085 | Maven |
| PaymentService | Spring Boot + SePay | 8086 | Maven |
| RecommendationService | Node.js/Express + AWS DynamoDB | 8087 | npm |
| frontend | React 19 + TS + Vite + Tailwind v4 | 5173 | npm |

Infrastructure: MariaDB (3308→3306), Redis (6379), RabbitMQ (5672, 15672 mgmt UI).

All services register with Eureka. The API Gateway routes `/api/**` via `lb://SERVICE_NAME` lookups. Frontend calls `VITE_API_BASE_URL` (default `http://localhost:8080`).

## Developer Commands

**Full stack (prod-like):**
```bash
docker compose up --build -d
docker compose down
```

**Dev mode (hot reload for frontend + ProductService, JDWP debug ports for Java services):**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
Debug ports: UserService 5005, Api-Gateway 5006, DiscoveryServer 5007, NotificationService 5008, CartService 5009.

**Individual service dev (outside Docker):**
- Frontend: `cd frontend && npm install && npm run dev`
- ProductService / RecommendationService: `cd <service> && npm install && npm run dev`
- Java services (Maven): `cd <service> && ./mvnw spring-boot:run`
- Java services (Gradle): `cd <service> && ./gradlew bootRun`

### Build, Lint, Test Commands

**Frontend:**
```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run lint         # ESLint (flat config)
npm run preview      # Preview production build
```
Note: No test framework configured. No Prettier standalone script (integrated via ESLint).

**ProductService / RecommendationService:**
```bash
npm run dev          # nodemon (hot reload)
npm start            # node (production)
```
Note: No test or lint scripts configured.

**Java Services (Maven: UserService, CartService, OrderService, PaymentService):**
```bash
./mvnw clean package           # Build
./mvnw spring-boot:run         # Run
./mvnw test                    # Run all tests
./mvnw test -Dtest=ClassName   # Run single test class
./mvnw test -Dtest=ClassName#methodName  # Run single test method
```

**Java Services (Gradle: DiscoveryServer, Api-Gateway, NotificationService):**
```bash
./gradlew build                # Build + test
./gradlew bootRun              # Run
./gradlew test                 # Run all tests
./gradlew test --tests ClassName       # Run single test class
./gradlew test --tests "ClassName.methodName"  # Run single test method
```

## Environment Files

Each service has its own `.env` (copied from `.env.example`). Root `.env` holds MariaDB and RabbitMQ credentials.

Critical env gotchas:
- `JWT_SECRET` in `UserService/.env` must be ≥32 bytes.
- `ProductService/.env` needs AWS credentials, `TABLE_NAME`, `BUCKET_NAME`, `CATEGORY_TABLE_NAME`, `VARIANT_TABLE_NAME`.
- `VITE_API_BASE_URL` in `frontend/.env` must be reachable from the browser (rebuild frontend image after changing).
- Eureka registration: set `EUREKA_SERVER_URL` in each Java/Node service `.env`. Use `http://host.docker.internal:8761/eureka` if Eureka runs on host, or `http://discovery-server:8761/eureka` inside Docker network.

## Code Style Guidelines

### Frontend (React 19 + TypeScript)
- **Formatting**: 2-space indent, semicolons required, ESLint flat config with Prettier integration
- **Naming**: `PascalCase` for components, `camelCase` for variables/functions, `use*` prefix for hooks
- **Types**: Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` enabled)
- **Imports**: Use `@/*` path aliases (maps to `./*`), group imports: React/external → internal → relative
- **State**: Zustand for client state (with persist middleware), TanStack Query for server state
- **Components**: shadcn/ui + Radix UI primitives in `components/ui/`, app-specific in `components/`
- **API**: Axios instances in `services/` with auto token refresh logic
- **Routing**: React Router v7 (`createBrowserRouter`)

### Java Services (Spring Boot 3.x, Java 21)
- **Packages**: `iuh.fit.<ServiceName>` (lowercase). Note: OrderService uses `com.iuh.fit`
- **Naming**: `PascalCase` classes, `camelCase` methods/fields, `UPPER_SNAKE_CASE` constants
- **Annotations**: Lombok (`@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`) for boilerplate
- **Layers**: `controller/` → `service/` → `repository/` with `domain/` for entities/DTOs/enums
- **Error handling**: `@RestControllerAdvice` with `@ExceptionHandler` in `GlobalExceptionHandler`
- **Security**: JWT validation via Api-Gateway; services use `GatewayIdentityFilter` for internal auth
- **API docs**: springdoc-openapi at `/<service>/swagger-ui.html`

### Node.js Services (ProductService, RecommendationService)
- **Modules**: ES modules (`"type": "module"`), `.js` extension
- **Naming**: `camelCase` for files/functions, `PascalCase` for classes
- **Structure**: `controllers/` → `services/` → `models/` → `routes/` → `middlewares/`
- **API docs**: Swagger/OpenAPI at `/<service>/api-docs`

## Key Conventions

- **API paths**: All client-facing APIs go through Gateway at `http://localhost:8080/api/**`. Direct service ports are for debugging only.
- **Git**: `.env` files are gitignored; commit `.env.example` templates only.
- **No `.editorconfig`** exists; follow conventions above.
- **No test framework** for frontend or Node.js services; Java services use JUnit 5.

## Troubleshooting

- Service not in Eureka: check `EUREKA_SERVER_URL` in service `.env`, confirm `discovery-server` is healthy at `http://localhost:8761`.
- Gateway 404: verify route uses `lb://USERSERVICE` / `lb://PRODUCTSERVICE` etc. and service names match Eureka registrations.
- Frontend API failures: ensure `VITE_API_BASE_URL` is correct; rebuild frontend image after env changes (`docker compose build frontend`).
- ProductService AWS errors: verify credentials and table/bucket names in `ProductService/.env`.
- Env changes not picked up: `docker compose down && docker compose up --build -d`.
- Root `docker-compose.yml` is the source of truth; ignore any per-service `docker-compose.yaml` files (e.g., `UserService/docker-compose.yaml` is legacy).

## Verify After `up`

```bash
docker compose ps
curl http://localhost:8761                    # Eureka dashboard
curl http://localhost:8080/actuator/health    # Gateway health
curl http://localhost:8080/api/products       # Products via gateway
```
