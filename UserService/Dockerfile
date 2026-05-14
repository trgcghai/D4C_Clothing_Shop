# Build stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -DskipTests package

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl && addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
RUN mkdir -p /app/config && chown -R appuser:appgroup /app/config
USER appuser
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://localhost:8081/v3/api-docs >/dev/null || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
