# D4C Clothing Shop - EC2 Deployment Guide

This guide covers deploying the full microservices stack to an AWS EC2 instance using Docker Compose.

---

## 1. EC2 Instance Requirements

### Minimum (Dev / Testing)

| Spec | Value |
|------|-------|
| Instance type | `t3.large` (2 vCPU, 8 GB RAM) |
| Storage | 40 GB gp3 |
| OS | Ubuntu 22.04 / 24.04 LTS or Amazon Linux 2023 |

### Recommended (Production)

| Spec | Value |
|------|-------|
| Instance type | `t3.xlarge` (4 vCPU, 16 GB RAM) or `m5.large` |
| Storage | 60 GB+ gp3 |
| OS | Ubuntu 24.04 LTS |

> **Note:** The stack runs ~15 containers. Java services alone consume ~4 GB. For real production, consider splitting services across multiple instances or migrating to ECS / EKS.

---

## 2. EC2 Server Setup

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

---

## 3. Security Group Configuration

Open these ports in your EC2 Security Group:

| Port | Purpose | Access |
|------|---------|--------|
| 22 | SSH | Your IP only |
| 80 | HTTP (Nginx) | 0.0.0.0/0 |
| 443 | HTTPS (Nginx) | 0.0.0.0/0 |

**Keep these internal only** (do NOT open to 0.0.0.0/0):

| Port | Service |
|------|---------|
| 8080 | API Gateway |
| 5173 | Frontend (Vite dev server — replace with Nginx in production) |
| 8761 | Eureka Dashboard |
| 15672 | RabbitMQ Management |
| 5601 | Kibana |
| 9200 | Elasticsearch |
| 3308 | MariaDB |
| 6379 | Redis |
| 5672 | RabbitMQ AMQP |
| 8108 | Typesense |

---

## 4. Deploy the Application

### 4.1 Clone / Upload Code

```bash
# Option A: Clone from Git
git clone <your-repo-url> d4c-clothing
cd d4c-clothing

# Option B: SCP from local machine (run on your PC)
scp -r . -i your-key.pem ubuntu@<EC2_PUBLIC_IP>:~/d4c-clothing
```

### 4.2 Configure Environment Files

**Root `.env`:**

```bash
cp .env.example .env
nano .env
```

```env
MYSQL_ROOT_PASSWORD=your-strong-root-password
MYSQL_USER=d4c_user
MYSQL_PASSWORD=your-strong-user-password

RABBITMQ_DEFAULT_USER=rabbitmq_user
RABBITMQ_DEFAULT_PASS=your-strong-rabbitmq-password

TYPESENSE_API_KEY=your-typesense-api-key
```

**Per-service `.env` files:**

```bash
# Create .env from .env.example for every service
for dir in UserService Api-Gateway NotificationService CartService \
           OrderService PaymentService DiscoveryServer ProductService \
           RecommendationService AIService SearchService frontend; do
  cp "$dir/.env.example" "$dir/.env" 2>/dev/null
done
```

**Critical values to set in each service `.env`:**

| File | Key | Value |
|------|-----|-------|
| `UserService/.env` | `JWT_SECRET` | ≥ 32 characters, strong random string |
| `UserService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `Api-Gateway/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `NotificationService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `CartService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `OrderService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `PaymentService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `DiscoveryServer/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `ProductService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `ProductService/.env` | `AWS_*` | Your AWS credentials for DynamoDB / S3 |
| `RecommendationService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `AIService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `SearchService/.env` | `EUREKA_SERVER_URL` | `http://discovery-server:8761/eureka` |
| `frontend/.env` | `VITE_API_BASE_URL` | `http://<EC2_PUBLIC_IP>:8080` or your domain |

> All services on the same Docker network use `http://discovery-server:8761/eureka` for Eureka. Do NOT use `host.docker.internal` on EC2.

### 4.3 Build and Start

```bash
docker compose up --build -d
```

### 4.4 Verify Deployment

```bash
# Check all containers are running
docker compose ps

# Follow logs
docker compose logs -f

# Eureka dashboard
curl http://localhost:8761

# API Gateway health
curl http://localhost:8080/actuator/health

# Test API through gateway
curl http://localhost:8080/api/products
```

---

## 5. Production Reverse Proxy (Nginx)

Do not expose ports 8080 / 5173 directly. Use Nginx as a reverse proxy.

### 5.1 Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
```

### 5.2 Nginx Configuration

Create `/etc/nginx/sites-available/d4c-clothing`:

```nginx
upstream frontend {
    server 127.0.0.1:5173;
}

upstream api_gateway {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name yourdomain.com;  # Replace with your domain or EC2 public IP

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # API Gateway
    location /api/ {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Eureka Dashboard (restrict to your IP)
    location /eureka/ {
        allow YOUR.IP.HERE;
        deny all;
        proxy_pass http://127.0.0.1:8761/;
    }

    # RabbitMQ Management (restrict to your IP)
    location /rabbitmq/ {
        allow YOUR.IP.HERE;
        deny all;
        proxy_pass http://127.0.0.1:15672/;
    }
}
```

### 5.3 Enable and Reload

```bash
sudo ln -s /etc/nginx/sites-available/d4c-clothing /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5.4 Update Frontend Env

After setting up Nginx, update `frontend/.env`:

```env
VITE_API_BASE_URL=http://yourdomain.com
# or
VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>
```

Then rebuild the frontend container:

```bash
docker compose build frontend
docker compose up -d frontend
```

---

## 6. SSL with Let's Encrypt (Free)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically update your Nginx config to redirect HTTP → HTTPS and add SSL certificates.

---

## 7. Resource Limits

Add `deploy.resources` to each service in `docker-compose.yml` to prevent OOM kills:

```yaml
services:
  userservice:
    # ... existing config ...
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

### Recommended Memory Allocation

| Service | Limit |
|---------|-------|
| Java services (×8) | 512 MB each → 4 GB total |
| Node.js services (×3) | 256 MB each → 768 MB total |
| Elasticsearch | 1 GB |
| MariaDB | 512 MB |
| Redis | 128 MB |
| RabbitMQ | 256 MB |
| Frontend | 128 MB |
| Typesense | 256 MB |
| Kibana | 512 MB |
| **Total** | **~7.5 GB** |

---

## 8. Auto-Restart on Reboot

Add to every service in `docker-compose.yml`:

```yaml
restart: unless-stopped
```

Enable Docker on boot:

```bash
sudo systemctl enable docker
```

---

## 9. Useful Commands

```bash
# View all container logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f api-gateway
docker compose logs -f --tail=100 userservice

# Restart a single service
docker compose restart userservice

# Rebuild after code changes
docker compose up --build -d

# Stop everything
docker compose down

# Stop and remove volumes (WARNING: wipes all data)
docker compose down -v

# Monitor resource usage
docker stats

# Prune unused images / containers
docker system prune -af
```

---

## 10. Troubleshooting

### Service not appearing in Eureka

```bash
# Check Eureka server URL in the service's .env
# Should be: EUREKA_SERVER_URL=http://discovery-server:8761/eureka

# Check discovery-server is healthy
curl http://localhost:8761

# Check service logs
docker compose logs <service-name>
```

### Gateway returns 404

```bash
# Verify service is registered in Eureka
curl http://localhost:8761/eureka/apps

# Check Gateway route config
docker compose logs api-gateway
```

### Frontend can't reach API

```bash
# Verify VITE_API_BASE_URL in frontend/.env
# Rebuild frontend after changing env
docker compose build frontend
docker compose up -d frontend
```

### Containers OOM killed

```bash
# Check dmesg for OOM killer
sudo dmesg | grep -i oom

# Increase instance size or add memory limits
docker stats
```

### Elasticsearch won't start

```bash
# Increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144

# Make it permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 11. CI/CD Deployment Script (Optional)

Save as `deploy.sh` on your EC2:

```bash
#!/bin/bash
set -e

echo "=== D4C Clothing Shop Deployment ==="

cd ~/d4c-clothing || exit 1

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up --build -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Health check
echo "Checking API Gateway health..."
curl -sf http://localhost:8080/actuator/health && echo "OK" || echo "FAILED"

echo "=== Deployment Complete ==="
```

```bash
chmod +x deploy.sh
```

---

## 12. Post-Deployment Checklist

- [ ] All containers running: `docker compose ps`
- [ ] Eureka dashboard accessible: `http://<IP>:8761`
- [ ] All services registered in Eureka
- [ ] API Gateway health check passes: `curl http://<IP>:8080/actuator/health`
- [ ] Frontend loads in browser
- [ ] Nginx reverse proxy working
- [ ] SSL certificate installed (if using domain)
- [ ] Internal ports (3308, 6379, 5672, 9200, etc.) NOT exposed to public
- [ ] `.env` files contain strong passwords
- [ ] Docker auto-start enabled: `sudo systemctl enable docker`
- [ ] Log rotation configured (optional)
