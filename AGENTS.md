# Repository Guidelines

## Architecture

This is a microservices monorepo with 8 application services, 1 API gateway, 1 service registry, and 3 infrastructure components, all orchestrated via Docker Compose.

| Service | Tech | Port | Build |
|---|---|---|---|
| DiscoveryServer | Spring Boot (Eureka) | 8761 | Gradle |
| Api-Gateway | Spring Cloud Gateway | 8080 | Gradle |
| UserService | Spring Boot (auth/users) | 8081 | Maven |
| ProductService | Node.js/Express + AWS DynamoDB/S3 | 8082 | npm |
| NotificationService | Spring Boot | 8083 | Gradle |
| CartService | Spring Boot + Redis | 8084 | Maven |
| OrderService | Spring Boot | 8085 | Maven |
| PaymentService | Spring Boot | 8086 | Maven |
| frontend | React 19 + TS + Vite + Tailwind v4 | 5173 | npm |

Infrastructure: MariaDB (3308→3306), Redis (6379), RabbitMQ (5672, 15672 mgmt UI).

All services register with Eureka. The API Gateway routes `/api/auth/**`, `/api/users/**`, `/api/products/**`, etc. via `lb://SERVICE_NAME` lookups. Frontend calls `VITE_API_BASE_URL` (default `http://localhost:8080`).

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
- ProductService: `cd ProductService && npm install && npm run dev`
- Java services: `./mvnw spring-boot:run` (Maven) or `./gradlew bootRun` (Gradle)

**Frontend:**
- `npm run build` runs `tsc -b && vite build`
- `npm run lint` runs ESLint
- `npm run preview` previews production build

**Java services tests:** `./mvnw test` (Maven) or `./gradlew test` (Gradle)

## Environment Files

Each service has its own `.env` (copied from `.env.example`). Root `.env` holds MariaDB and RabbitMQ credentials.

Critical env gotchas:
- `JWT_SECRET` in `UserService/.env` must be ≥32 bytes.
- `ProductService/.env` needs AWS credentials, `TABLE_NAME`, `BUCKET_NAME`, `CATEGORY_TABLE_NAME`, `VARIANT_TABLE_NAME`.
- `VITE_API_BASE_URL` in `frontend/.env` must be reachable from the browser (rebuild frontend image after changing).
- Eureka registration: set `EUREKA_SERVER_URL` in each Java/Node service `.env`. Use `http://host.docker.internal:8761/eureka` if Eureka runs on host, or `http://discovery-server:8761/eureka` inside Docker network.

## Key Conventions

- **Frontend**: React 19, TypeScript, Tailwind v4, Radix UI + shadcn, Zustand for state, TanStack Query for server state, React Router v7, Axios for HTTP. 2-space indent, semicolons, `PascalCase` components, `camelCase` variables.
- **Java services**: Spring Boot 3.x, standard conventions. Maven services (UserService, CartService, OrderService, PaymentService); Gradle services (DiscoveryServer, Api-Gateway, NotificationService).
- **ProductService**: ES modules (`"type": "module"`), Express, AWS SDK v3, Eureka JS client, Swagger/OpenAPI docs at `/api-docs`.
- **API paths**: All client-facing APIs go through Gateway at `http://localhost:8080/api/**`. Direct service ports are for debugging only.
- **Git**: `.env` files are gitignored; commit `.env.example` templates only.

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
