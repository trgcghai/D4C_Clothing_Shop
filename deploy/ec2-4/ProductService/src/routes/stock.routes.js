import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { deductBatchStock, restoreBatchStock } from "../controllers/stock.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: stock
 *     description: Batch stock management endpoints (internal only)
 */

/**
 * @swagger
 * /api/products/stock/deduct-batch:
 *   post:
 *     tags: [stock]
 *     summary: Atomically deduct stock for multiple variants via DynamoDB transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [variantId, quantity]
 *               properties:
 *                 variantId:
 *                   type: string
 *                 quantity:
 *                   type: integer
 *                   minimum: 1
 *           examples:
 *             default:
 *               value:
 *                 - variantId: "var_123"
 *                   quantity: 2
 *                 - variantId: "var_456"
 *                   quantity: 1
 *     responses:
 *       200:
 *         description: All stock deducted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Insufficient stock or invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 failedItems:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       variantId:
 *                         type: string
 *                       reason:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.post("/deduct-batch", requireAuth, deductBatchStock);

/**
 * @swagger
 * /api/products/stock/restore-batch:
 *   post:
 *     tags: [stock]
 *     summary: Atomically restore stock for multiple variants via DynamoDB transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [variantId, quantity]
 *               properties:
 *                 variantId:
 *                   type: string
 *                 quantity:
 *                   type: integer
 *                   minimum: 1
 *           examples:
 *             default:
 *               value:
 *                 - variantId: "var_123"
 *                   quantity: 2
 *                 - variantId: "var_456"
 *                   quantity: 1
 *     responses:
 *       200:
 *         description: All stock restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Failed to restore stock
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 failedItems:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       variantId:
 *                         type: string
 *                       reason:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.post("/restore-batch", requireAuth, restoreBatchStock);

export default router;
