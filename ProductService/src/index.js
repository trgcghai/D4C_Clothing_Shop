import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import productRoutes from "./routes/product.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(morgan("dev")); // Log requests to terminal
app.use(cors());
app.use(express.json());
// Middleware parse x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.use("/api/products", productRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Product Service API is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
