import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import eurekaClient from "./config/eureka.config.js";
import chatRoutes from "./routes/chat.routes.js";
import tagsRoutes from "./routes/tags.routes.js";
import { openApiSpec } from "./config/openapi.js";

dotenv.config();

const app = express();

// Note: CORS is handled by API Gateway — do NOT add cors() middleware here
app.use(express.json());
app.use(morgan("dev"));

// Swagger
app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.get("/api/ai/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

app.use("/api/ai", chatRoutes);
app.use("/api/ai/tags", tagsRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 8086;

app.listen(PORT, () => {
  console.log(`AIService running on port ${PORT}`);
  console.log(
    `API documentation available at http://localhost:${PORT}/api-docs`,
  );
  eurekaClient.start((error) => {
    if (error) {
      console.error("Error registering with Eureka:", error);
    } else {
      console.log("Registered with Eureka");
    }
  });
});
