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

## Kiến trúc chạy local (Docker Compose)

- `DiscoveryServer` (Eureka): `8761`
- `Api-Gateway` (entrypoint API): `8080`
- `UserService`: `8081`
- `ProductService`: `8082`
- `frontend` (Vite): `5173`
- `mariadb`: `3307` (map ra host), `3306` trong network Docker

Gateway route qua Eureka (`lb://...`) cho:
- `/api/auth/**`
- `/api/users/**`
- `/api/products/**`

## Environment files (hiện tại)

Compose đang dùng `env_file` theo từng service:

- `./DiscoveryServer/.env`
- `./Api-Gateway/.env`
- `./UserService/.env`
- `./ProductService/.env`
- `./frontend/.env`
- `./.env.mariadb`

Nếu thiếu file env, bạn có thể tham chiếu từ template:

```bash
cp .env.example .env.local.reference
```

Lưu ý:
- `JWT_SECRET` phải set trong `UserService/.env` và có độ dài tối thiểu 32 bytes.
- AWS credentials / bucket / table set trong `ProductService/.env`.

## Chạy full stack (prod-like)

```bash
docker compose up --build -d
```

## Dừng stack

```bash
docker compose down
```

## Chạy dev mode (hot reload cho frontend + product)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Public URLs

- Frontend: `http://localhost:5173`
- API Gateway: `http://localhost:8080`
- Eureka Dashboard: `http://localhost:8761`
- UserService direct: `http://localhost:8081`
- ProductService direct: `http://localhost:8082`

## API qua Gateway

- Auth: `http://localhost:8080/api/auth/**`
- Users: `http://localhost:8080/api/users/**`
- Products: `http://localhost:8080/api/products/**`

## Verify nhanh sau khi up

```bash
docker compose ps
curl http://localhost:8761
curl http://localhost:8080/actuator/health
curl http://localhost:8080/api/products
```

## Troubleshooting

- Service not in Eureka:
  - Check `EUREKA_SERVER_URL` / `EUREKA_HOST` trong file `.env` của service.
  - Confirm `discovery-server` is healthy.
- Gateway returns `404`:
  - Verify route targets use `lb://USERSERVICE` and `lb://PRODUCTSERVICE`.
  - Verify service names registered in Eureka.
- Frontend cannot call API:
  - Ensure `VITE_API_URL` is host reachable (`http://localhost:8080/api`).
  - Rebuild frontend image after changing `VITE_API_URL`:
  - `docker compose build frontend`
- ProductService startup fails with AWS/Dynamo:
  - Ensure AWS credentials, `TABLE_NAME`, and `BUCKET_NAME` are set correctly in `ProductService/.env`.

## Ghi chú thêm

- `UserService/docker-compose.yaml` là compose riêng module cũ; flow chuẩn hiện tại là root `docker-compose.yml`.
- Nếu đổi env mà service chưa nhận, chạy lại:

```bash
docker compose down
docker compose up --build -d
```
