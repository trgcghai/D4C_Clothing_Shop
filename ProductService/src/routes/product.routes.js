import express from "express";
import { uploadImage } from "../middlewares/upload.middleware.js";
import { uploadZip } from "../middlewares/zip-upload.middleware.js";
import { requireAdmin, requireAuth } from "../middlewares/auth.middleware.js";
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
  deductStock,
  restoreStock,
} from "../controllers/product.controller.js";
import { importZipProducts } from "../controllers/zip-import.controller.js";
import cacheRouter from "./cache.routes.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: products
 *     description: Product browsing and management endpoints
 */

// ─── Cache routes ────────────────────────────────────────────────────────────────
router.use("/cache", cacheRouter);

// ─── Special routes MUST be before /:id ────────────────────────────────────────
/**
 * @swagger
 * /api/products/search:
 *   get:
 *     tags: [products]
 *     summary: Search products
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search keyword
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Search result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedProducts'
 *       400:
 *         description: Missing keyword
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 */
router.get("/search", searchProducts);
/**
 * @swagger
 * /api/products/featured:
 *   get:
 *     tags: [products]
 *     summary: Get featured products
 *     responses:
 *       200:
 *         description: Featured products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       500:
 *         description: Server error
 */
router.get("/featured", getFeaturedProducts);
/**
 * @swagger
 * /api/products/new-arrivals:
 *   get:
 *     tags: [products]
 *     summary: Get new arrival products
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of latest products, default 8
 *     responses:
 *       200:
 *         description: New arrival products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       500:
 *         description: Server error
 */
router.get("/new-arrivals", getNewArrivals);

// ─── ZIP Import ───────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/products/import-zip:
 *   post:
 *     tags: [products]
 *     summary: Import products from ZIP file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               zipFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Products imported successfully
 *       400:
 *         description: Validation errors
 *       413:
 *         description: File too large
 *       415:
 *         description: Wrong file format
 */
router.post(
  "/import-zip",
  requireAdmin,
  uploadZip.single("zipFile"),
  importZipProducts,
);

// ─── Listing & Browsing ─────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [products]
 *     summary: Get all products with filtering/sorting/pagination
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *       - in: query
 *         name: size
 *         schema:
 *           type: string
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedProducts'
 *       500:
 *         description: Server error
 */
router.get("/", getAllProducts);

// ─── Single product ─────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     tags: [products]
 *     summary: Get product by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get("/:id", getProduct);
/**
 * @swagger
 * /api/products/{id}/related:
 *   get:
 *     tags: [products]
 *     summary: Get related products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Related products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       500:
 *         description: Server error
 */
router.get("/:id/related", getRelatedProducts);

// ─── Stock Management ───────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/products/variants/{variantId}/deduct-stock:
 *   post:
 *     tags: [products]
 *     summary: Deduct variant stock atomically
 *     parameters:
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Stock deducted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 variantId:
 *                   type: string
 *                 remaining:
 *                   type: integer
 *       400:
 *         description: Insufficient stock or invalid quantity
 *       500:
 *         description: Server error
 */
router.post("/variants/:variantId/deduct-stock", requireAuth, deductStock);

/**
 * @swagger
 * /api/products/variants/{variantId}/restore-stock:
 *   post:
 *     tags: [products]
 *     summary: Restore variant stock atomically
 *     parameters:
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Stock restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 variantId: { type: string }
 *                 restored: { type: integer }
 *                 current: { type: integer }
 *       404:
 *         description: Variant not found
 *       500:
 *         description: Server error
 */
router.post("/variants/:variantId/restore-stock", requireAuth, restoreStock);

// ─── Admin CRUD ─────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/products:
 *   post:
 *     tags: [products]
 *     summary: Create product
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpsertRequest'
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  uploadImage.single("productImage"),
  requireAdmin,
  createNewProduct,
);
/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     tags: [products]
 *     summary: Update product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpsertRequest'
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       500:
 *         description: Server error
 */
router.put(
  "/:id",
  uploadImage.single("productImage"),
  requireAdmin,
  updateProduct,
);
/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     tags: [products]
 *     summary: Delete product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.delete("/:id", requireAdmin, deleteProduct);

export default router;
