# Add Actuator Health Checks to Spring Boot Services

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Spring Boot Actuator to UserService and OrderService (missing it), then standardize all 4 Spring Boot service health checks in docker-compose.yml to use `/actuator/health`.

**Architecture:** Two services need the actuator dependency added. Two services already have it but use `/v3/api-docs` for health checks. docker-compose.yml health checks will be unified to `/actuator/health` for consistency.

**Tech Stack:** Spring Boot 3.3.1, Maven (UserService, OrderService), Gradle (NotificationService), Docker Compose

---

### Task 1: Add Actuator to UserService

**Files:**
- Modify: `UserService/pom.xml`

- [ ] **Step 1: Add spring-boot-starter-actuator dependency**

Insert after the `spring-boot-starter-amqp` dependency block (around line 121) in `UserService/pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

- [ ] **Step 2: Verify compilation**

Run: `cd UserService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add UserService/pom.xml
git commit -m "feat: add spring-boot-starter-actuator to UserService"
```

---

### Task 2: Add Actuator to OrderService

**Files:**
- Modify: `OrderService/pom.xml`

- [ ] **Step 1: Add spring-boot-starter-actuator dependency**

Insert after the `spring-boot-starter-amqp` dependency block (around line 97) in `OrderService/pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

- [ ] **Step 2: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add OrderService/pom.xml
git commit -m "feat: add spring-boot-starter-actuator to OrderService"
```

---

### Task 3: Standardize health checks in docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update UserService health check**

Change line 99 from:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8081/v3/api-docs"]
```
To:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8081/actuator/health"]
```

- [ ] **Step 2: Update NotificationService health check**

Change line 147 from:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8083/v3/api-docs"]
```
To:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8083/actuator/health"]
```

- [ ] **Step 3: Update OrderService health check**

Change line 193 from:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8085/v3/api-docs"]
```
To:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8085/actuator/health"]
```

- [ ] **Step 4: Update PaymentService health check**

Change line 217 from:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8086/v3/api-docs"]
```
To:
```yaml
test: ["CMD", "curl", "-fsS", "http://localhost:8086/actuator/health"]
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "refactor: standardize all Spring Boot health checks to /actuator/health"
```

---

### Task 4: Verify all services build

**Files:** No file changes.

- [ ] **Step 1: Build UserService and OrderService**

Run:
```bash
cd UserService && ./mvnw clean package -DskipTests -q && cd ..
cd OrderService && ./mvnw clean package -DskipTests -q && cd ..
```
Expected: Both BUILD SUCCESS

- [ ] **Step 2: Commit verification**

```bash
git add -A
git commit -m "chore: verify all services build with actuator"
```
