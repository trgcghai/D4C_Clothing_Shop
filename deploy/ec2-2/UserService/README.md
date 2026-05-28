# UserService

## Docker Compose

Chay he thong bang Docker:

```bash
docker compose up --build
```

Sau khi khoi dong, API se san sang tai http://localhost:8080.

## Eureka khi chay Docker

Luu y: trong container, `localhost` la chinh container do, khong phai may host.

Da cau hinh `docker-compose.yaml`:
- `EUREKA_SERVER_URL=http://host.docker.internal:8761/eureka` (Eureka chay tren may host)

Neu Eureka chay trong cung Docker network, doi thanh:
- `EUREKA_SERVER_URL=http://<ten-service-eureka>:8761/eureka`

Neu tam thoi chua co Eureka, co the tat client:
- `EUREKA_CLIENT_ENABLED=false`
