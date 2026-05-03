import express from "express";
import { uploadImage } from "../middlewares/upload.middleware.js";
import {
  getAllProducts,
  getProduct,
  createNewProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getFeaturedProducts,
  getNewArrivals,
  getRelatedProducts,
} from "../controllers/product.controller.js";

const router = express.Router();

// ─── Special routes MUST be before /:id ────────────────────────────────────────
router.get("/search", searchProducts);
router.get("/featured", getFeaturedProducts);
router.get("/new-arrivals", getNewArrivals);

// ─── Listing & Browsing ─────────────────────────────────────────────────────────
router.get("/", getAllProducts);

// ─── Single product ─────────────────────────────────────────────────────────────
router.get("/:id", getProduct);
router.get("/:id/related", getRelatedProducts);

// ─── Admin CRUD ─────────────────────────────────────────────────────────────────
router.post("/", uploadImage.single("productImage"), createNewProduct);
router.put("/:id", uploadImage.single("productImage"), updateProduct);
router.delete("/:id", deleteProduct);

export default router;
