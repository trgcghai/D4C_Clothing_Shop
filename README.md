# D4C_Clothing_Shop

## Thành viên nhóm

- Trương Công Hải - 22692311
- Đặng Trần Tấn Phát - 22649051
- Huỳnh Ánh Hưng - 22645171
- Lê Huỳnh Công Tiếp - 22692271
- Lê Minh Tuấn - 22697621

## Services

- `frontend/`: React + Vite client
- `ProductService/`: Node.js/Express product API
- `UserService/`: Spring Boot auth/user API
- `Api-Gateway/`: Spring Cloud Gateway API entrypoint
- `DiscoveryServer/`: Eureka service registry

## Docker Full Stack

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill required secrets in `.env` (`JWT_SECRET`, AWS values if needed).
3. Build and run:

```bash
docker compose up --build -d
```

### Stop stack

```bash
docker compose down
```

### Dev mode (with hot reload override)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Public URLs

- Frontend: `http://localhost:5173`
- API Gateway: `http://localhost:8080`
- Eureka Dashboard: `http://localhost:8761`
- UserService direct: `http://localhost:8081`
- ProductService direct: `http://localhost:8082`

## API Endpoints via Gateway

- Auth: `http://localhost:8080/api/auth/**`
- Users: `http://localhost:8080/api/users/**`
- Products: `http://localhost:8080/api/products/**`

## Troubleshooting

- Service not in Eureka:
  - Check `EUREKA_SERVER_URL` / `EUREKA_HOST` values in compose env.
  - Confirm `discovery-server` is healthy.
- Gateway returns `404`:
  - Verify route targets use `lb://USERSERVICE` and `lb://PRODUCTSERVICE`.
  - Verify service names registered in Eureka.
- Frontend cannot call API:
  - Ensure `VITE_API_URL` is host reachable (`http://localhost:8080/api`).
  - Rebuild frontend image after changing `VITE_API_URL`:
  - `docker compose build frontend`
- ProductService startup fails with AWS/Dynamo:
  - Ensure AWS credentials, `TABLE_NAME`, and `BUCKET_NAME` are set correctly in `.env`.
