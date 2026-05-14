import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import eurekaClient from "./config/eureka.config.js";
import chatRoutes from "./routes/chat.routes.js";

dotenv.config();

const app = express();

// Note: CORS is handled by API Gateway — do NOT add cors() middleware here
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/v1/ai/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

app.use("/api/v1/ai", chatRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

const PORT = process.env.PORT || 8086;

app.listen(PORT, () => {
  console.log(`AIService running on port ${PORT}`);
  eurekaClient.start((error) => {
    if (error) {
      console.error("Error registering with Eureka:", error);
    } else {
      console.log("Registered with Eureka");
    }
  });
});
