import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import productRoutes from "./routes/product.routes.js";
import { openApiSpec } from "./config/openapi.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(morgan("dev")); // Log requests to terminal
app.use(cors());
app.use(express.json());
// Middleware parse x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api/products", productRoutes);

app.get("/health", (req, res) => {
  res.send("Product Service API is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
  console.log(
    `API documentation available at http://localhost:${PORT}/api-docs`,
  );
});
