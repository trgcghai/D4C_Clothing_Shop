# D4C_Clothing_Shop

## Services
- `frontend/`: React + Vite client
- `ProductService/`: Node.js/Express product API
- `UserService/`: Spring Boot auth/user API

## Quick Start
### ProductService
```bash
cd ProductService
npm install
npm run dev
```
Default URL: `http://localhost:5000`

### UserService
```bash
cd UserService
mvnw.cmd spring-boot:run
```
Default URL: `http://localhost:8080`

## Swagger / OpenAPI
### ProductService
- Swagger UI: `http://localhost:5000/api-docs`
- OpenAPI JSON: `http://localhost:5000/openapi.json`

### UserService
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## Smoke Check Commands
After services are running:
```bash
curl http://localhost:5000/openapi.json
curl http://localhost:8080/v3/api-docs
```

## Thành viên nhóm
- Trương Công Hải - 22692311
- Đặng Trần Tấn Phát - 22649051
- Huỳnh Ánh Hưng - 22645171
- Lê Huỳnh Công Tiếp - 22692271
- Lê Minh Tuấn - 22697621
