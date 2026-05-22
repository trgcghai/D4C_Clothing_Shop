# D4C Clothing Shop - CI/CD Guide

This guide covers setting up CI/CD pipelines for the microservices monorepo using **GitHub Actions**.

---

## Architecture Overview

The project has 3 build types:

| Type | Services | Build Tool |
|------|----------|------------|
| Java (Maven) | UserService, CartService, OrderService, PaymentService | `./mvnw clean package` |
| Java (Gradle) | DiscoveryServer, Api-Gateway, NotificationService, AIService, SearchService | `./gradlew build` |
| Node.js | ProductService, RecommendationService | `npm ci` |
| Frontend | frontend (React + Vite) | `npm ci && npm run build` |

---

## CI/CD Strategy

### Option 1: GitHub Actions → EC2 (Recommended for this project)

```
Push to GitHub → GitHub Actions builds images → Push to Docker Hub / GHCR → SSH to EC2 → docker compose pull && up
```

**Pros:** Simple, no extra infrastructure, works with your existing Docker Compose setup.

### Option 2: GitHub Actions → AWS ECR → ECS/EKS

```
Push to GitHub → Build → Push to ECR → Deploy to ECS/EKS
```

**Pros:** Fully managed, auto-scaling, zero-downtime deploys.

**Cons:** Requires migrating from Docker Compose to ECS task definitions.

### Option 3: Self-hosted Runner on EC2

```
Push to GitHub → EC2 runner builds locally → docker compose up
```

**Pros:** Fast (no image push/pull), no registry needed.

**Cons:** Ties CI to a single server.

---

## Option 1: GitHub Actions → EC2 (Full Setup)

### Step 1: Create Docker Registry

Use **GitHub Container Registry (GHCR)** — it's free for public repos and included with your plan for private repos.

No setup needed. Images will be pushed to `ghcr.io/<your-username>/d4c-clothing/<service-name>`.

### Step 2: Configure GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions** → Add these secrets:

| Secret | Description |
|--------|-------------|
| `EC2_HOST` | EC2 public IP or DNS (e.g., `ec2-xx-xx-xx-xx.compute-1.amazonaws.com`) |
| `EC2_USERNAME` | SSH user (e.g., `ubuntu` or `ec2-user`) |
| `EC2_SSH_KEY` | Private key content of your EC2 key pair (paste the full `.pem` content) |

### Step 3: Create the CI/CD Workflow

Create `.github/workflows/ci-cd.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository_owner }}/d4c-clothing

jobs:
  # ==========================================
  # PHASE 1: Test & Lint
  # ==========================================
  test-frontend:
    name: Test Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run build

  test-product-service:
    name: Test ProductService
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: ProductService/package-lock.json
      - run: cd ProductService && npm ci

  test-recommendation-service:
    name: Test RecommendationService
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: RecommendationService/package-lock.json
      - run: cd RecommendationService && npm ci

  test-java-maven:
    name: Test Java (Maven)
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [UserService, CartService, OrderService, PaymentService]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'maven'
      - run: cd ${{ matrix.service }} && chmod +x mvnw && ./mvnw clean test

  test-java-gradle:
    name: Test Java (Gradle)
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [DiscoveryServer, Api-Gateway, NotificationService, AIService, SearchService]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'gradle'
      - run: cd ${{ matrix.service }} && chmod +x gradlew && ./gradlew test

  # ==========================================
  # PHASE 2: Build & Push Docker Images
  # ==========================================
  build-and-push:
    name: Build & Push Images
    needs: [test-frontend, test-product-service, test-recommendation-service, test-java-maven, test-java-gradle]
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - DiscoveryServer
          - Api-Gateway
          - UserService
          - ProductService
          - NotificationService
          - CartService
          - OrderService
          - PaymentService
          - RecommendationService
          - AIService
          - SearchService
          - frontend
      max-parallel: 4
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.service }}
          file: ./${{ matrix.service }}/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ==========================================
  # PHASE 3: Deploy to EC2
  # ==========================================
  deploy:
    name: Deploy to EC2
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/d4c-clothing || exit 1
            git pull origin main

            # Login to GHCR
            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

            # Pull latest images
            docker compose pull

            # Recreate containers with new images
            docker compose up -d

            # Wait for services to start
            sleep 45

            # Health check
            curl -sf http://localhost:8080/actuator/health || exit 1

            # Cleanup old images
            docker image prune -f
```

### Step 4: Update docker-compose.yml for Production

Add `image` keys alongside `build` keys so `docker compose pull` works:

```yaml
services:
  discovery-server:
    build:
      context: ./DiscoveryServer
      dockerfile: Dockerfile
    image: ghcr.io/<your-username>/d4c-clothing/discovery-server:main
    # ... rest of config
```

Or use a `.env` variable:

```yaml
services:
  discovery-server:
    build:
      context: ./DiscoveryServer
      dockerfile: Dockerfile
    image: ${REGISTRY}/${IMAGE_PREFIX}/discovery-server:${TAG:-latest}
```

### Step 5: EC2 Deployment Script

On your EC2, create a deploy helper script:

```bash
#!/bin/bash
# ~/d4c-clothing/deploy.sh
set -e

cd ~/d4c-clothing

echo "Pulling latest images..."
docker compose pull

echo "Restarting services..."
docker compose up -d

echo "Waiting for services..."
sleep 45

echo "Health check..."
curl -sf http://localhost:8080/actuator/health && echo "OK" || echo "FAILED"

echo "Cleaning up..."
docker image prune -f

echo "Done!"
```

---

## Option 2: Self-Hosted GitHub Runner on EC2

Faster than SSH-based deploy because builds happen directly on the server.

### Step 1: Install Runner on EC2

```bash
ssh ubuntu@<EC2_IP>

# Create runner user
sudo useradd -m -s /bin/bash runner
sudo usermod -aG docker runner

# Install runner
cd /home/runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-*.tar.gz

# Register runner (get token from repo Settings → Actions → Runners)
sudo ./config.sh --url https://github.com/<your-org>/<your-repo> --token <TOKEN> --runnergroup default --unattended
sudo ./svc.sh install runner
sudo ./svc.sh start
```

### Step 2: Workflow Using Self-Hosted Runner

```yaml
name: CI/CD (Self-Hosted)

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: docker compose up --build -d
      - run: sleep 60
      - run: curl -sf http://localhost:8080/actuator/health
```

**Pros:** No image registry needed, fast deploys, builds on same hardware as production.

**Cons:** Runner must be always-on, less portable.

---

## Option 3: Blue-Green Deployment (Zero Downtime)

For production with zero downtime, use two compose stacks:

```yaml
# docker-compose.blue.yml (uses port mapping offset)
services:
  api-gateway:
    ports:
      - "8081:8080"  # Blue on 8081
```

```yaml
# docker-compose.green.yml
services:
  api-gateway:
    ports:
      - "8082:8080"  # Green on 8082
```

**Deploy script:**

```bash
#!/bin/bash
set -e

CURRENT=${1:-blue}
NEXT=${CURRENT:-blue}
if [ "$CURRENT" = "blue" ]; then NEXT="green"; fi

echo "Deploying to $NEXT..."
docker compose -f docker-compose.$NEXT.yml pull
docker compose -f docker-compose.$NEXT.yml up -d

echo "Waiting for $NEXT to be healthy..."
sleep 45

# Health check on new stack
if [ "$NEXT" = "blue" ]; then
  PORT=8081
else
  PORT=8082
fi

curl -sf http://localhost:$PORT/actuator/health || { echo "Health check failed!"; exit 1; }

# Switch Nginx to point to new stack
sed -i "s/server 127.0.0.1:808[12]/server 127.0.0.1:$PORT/g" /etc/nginx/sites-available/d4c-clothing
sudo nginx -s reload

# Stop old stack
docker compose -f docker-compose.$CURRENT.yml down

echo "Deployed to $NEXT successfully!"
```

---

## Branch Strategy

```
main          → Production (auto-deploy)
develop       → Staging (auto-deploy to staging EC2)
feature/*     → CI only (test + build, no deploy)
```

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

| Branch | Test | Build | Deploy |
|--------|------|-------|--------|
| `feature/*` | Yes | No | No |
| `develop` | Yes | Yes | Staging EC2 |
| `main` | Yes | Yes | Production EC2 |

---

## Environment-Specific Configs

Use GitHub Environments for staging vs production:

```yaml
deploy-staging:
  needs: build-and-push
  environment: staging
  runs-on: ubuntu-latest
  steps:
    - uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.STAGING_EC2_HOST }}
        # ...

deploy-production:
  needs: build-and-push
  environment: production
  runs-on: ubuntu-latest
  steps:
    - uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.PROD_EC2_HOST }}
        # ...
```

---

## Pipeline Optimization Tips

### 1. Parallel Builds

The workflow already uses `strategy.matrix` to build all services in parallel. Limit with `max-parallel: 4` to avoid hitting GitHub Actions concurrency limits.

### 2. Layer Caching

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

This caches Docker layers between runs, cutting build time by 50-70%.

### 3. Skip Unchanged Services

Use `dorny/paths-filter` to only build changed services:

```yaml
- uses: dorny/paths-filter@v3
  id: filter
  with:
    filters: |
      frontend:
        - 'frontend/**'
      userservice:
        - 'UserService/**'
      productservice:
        - 'ProductService/**'
```

### 4. Build Only Changed Services

```yaml
build-and-push:
  strategy:
    matrix:
      service: [DiscoveryServer, Api-Gateway, UserService, ...]
  steps:
    - uses: dorny/paths-filter@v3
      id: changes
      with:
        filters: |
          src:
            - '${{ matrix.service }}/**'
    - if: steps.changes.outputs.src == 'true'
      uses: docker/build-push-action@v5
      with:
        context: ./${{ matrix.service }}
        push: true
        # ...
```

---

## Monitoring & Alerts

### Slack / Discord Notifications

```yaml
notify:
  needs: [deploy]
  if: always()
  runs-on: ubuntu-latest
  steps:
    - uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        fields: repo,message,commit,author,workflow
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Health Monitoring

Add to your EC2 crontab:

```bash
# Check API Gateway every 5 minutes
*/5 * * * * curl -sf http://localhost:8080/actuator/health || echo "ALERT: API Gateway down!" | mail -s "D4C Alert" your@email.com
```

---

## Quick Start Checklist

- [ ] GitHub repo created and code pushed
- [ ] EC2 instance running with Docker installed
- [ ] GitHub secrets configured (`EC2_HOST`, `EC2_USERNAME`, `EC2_SSH_KEY`)
- [ ] `.github/workflows/ci-cd.yml` created
- [ ] `docker-compose.yml` updated with `image` keys
- [ ] First push to `main` triggers pipeline
- [ ] Verify deployment on EC2: `docker compose ps`
