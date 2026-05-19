import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import searchRoutes from "./routes/search.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { ensureCollection, ensureCategoryCollection } from "./services/sync.service.js";
import { initialSync } from "./services/initial-sync.service.js";
import { connect } from "./config/rabbitmq.config.js";
import { startConsumer } from "./consumers/product-event.consumer.js";
import { startCategoryConsumer } from "./consumers/category-event.consumer.js";
import eurekaClient from "./config/eureka.config.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8089;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes (most specific first to avoid shadowing)
app.use("/api/search/admin", adminRoutes);
app.use("/api/search/categories", categoryRoutes);
app.use("/api/search", searchRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    name: "Search Service",
    status: "UP",
  });
});

async function bootstrap() {
  try {
    // Ensure Typesense collections exist
    await ensureCollection();
    await ensureCategoryCollection();

    // Initial sync from ProductService
    await initialSync();

    // Connect to RabbitMQ and start consumers
    await connect();
    await startConsumer();
    await startCategoryConsumer();

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log(`SearchService running on http://localhost:${PORT}`);

      // Register with Eureka
      eurekaClient.start((err) => {
        if (err) {
          console.error("Eureka registration failed:", err);
        } else {
          console.log("SearchService registered with Eureka");
        }
      });
    });

    async function gracefulShutdown(signal) {
      console.log(`${signal} received, shutting down gracefully...`);

      // Stop accepting new connections
      server.close(async () => {
        console.log("HTTP server closed");

        // Deregister from Eureka
        await new Promise((resolve) => eurekaClient.stop(() => resolve()));
        console.log("Eureka client stopped");

        // Close RabbitMQ
        try {
          const { close } = await import("./config/rabbitmq.config.js");
          await close();
          console.log("RabbitMQ connection closed");
        } catch (err) {
          console.error("Error closing RabbitMQ:", err.message);
        }

        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    }

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (err) {
    console.error("Failed to start SearchService:", err);
    process.exit(1);
  }
}

bootstrap();


