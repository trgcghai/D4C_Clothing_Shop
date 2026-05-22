import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import stockRoutes from "./routes/stock.routes.js";
import eurekaClient from "./config/eureka.config.js";
import { openApiSpec } from "./config/openapi.js";
import { connectEventPublisher } from "./services/event-publisher.service.js";
import { close as closeRabbitMQ } from "./config/rabbitmq.publisher.js";
import { connectConsumer, consumeOrderCancelled, closeConsumer } from "./config/rabbitmq.consumer.js";
import { handleOrderCancelled } from "./consumers/orderCancelled.consumer.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8082;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api/products", productRoutes);
app.use("/api/products/stock", stockRoutes);
app.use("/api/categories", categoryRoutes);

app.get("/health", (req, res) => {
  res.json({
    name: "Product Service",
    status: "UP",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
  console.log(
    `API documentation available at http://localhost:${PORT}/api-docs`,
  );

  connectEventPublisher();

  // Connect RabbitMQ consumer for order cancelled events
  connectConsumer().then(() => {
    consumeOrderCancelled(handleOrderCancelled);
  });

  eurekaClient.start((err) => {
    if (err) {
      console.error("Eureka registration failed", err);
    } else {
      console.log("Registered with Eureka");
    }
  });
});

function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  eurekaClient.stop(() => {
    console.log("Eureka client stopped");
  });
  closeRabbitMQ().catch(console.error);
  closeConsumer().catch(console.error);
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
