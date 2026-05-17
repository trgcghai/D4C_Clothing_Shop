import express from "express";
import { generateTags } from "../controllers/tags.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @openapi
 * /api/v1/ai/tags/generate:
 *   post:
 *     tags: [tags]
 *     summary: Generate product tags via AI
 *     description: Generate an array of suitable product tags based on the provided product information. Identity is extracted from Gateway-injected X-User-* headers. Only admins should access this (handled via Gateway or Controller).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productData]
 *             properties:
 *               productData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Áo Polo Nam Trơn Basic"
 *                   description:
 *                     type: string
 *                     example: "Áo thun cổ bẻ chất liệu cotton thoáng mát"
 *                   categoryName:
 *                     type: string
 *                     example: "Áo Thun"
 *                   brand:
 *                     type: string
 *                     example: "D4C"
 *                   gender:
 *                     type: string
 *                     example: "Nam"
 *     responses:
 *       200:
 *         description: Tags generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Bad request (missing required fields)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/generate", requireAuth, generateTags);

export default router;
