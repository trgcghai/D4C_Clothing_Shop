import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import { recommendationRouter } from "./routes/recommendation.routes.js";
import eurekaClient from "./config/eureka.config.js";
import { getCircuitBreakerStats } from "./config/product-service-client.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8086;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/recommendations", recommendationRouter);

app.get("/health", (req, res) => {
  res.json({
    name: "Recommendation Service",
    status: "UP",
    circuitBreakers: {
      productService: getCircuitBreakerStats(),
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);

  eurekaClient.start((err) => {
    if (err) {
      console.error("Eureka registration failed", err);
    } else {
      console.log("Registered with Eureka");
    }
  });
});

process.on("SIGINT", () => {
  eurekaClient.stop(() => {
    console.log("Eureka client stopped");
    process.exit();
  });
});
