import express from "express";
import {
  recordBehavior,
  getRecommendations,
} from "../controllers/recommendation.controller.js";

const behaviorRouter = express.Router();
const recommendationRouter = express.Router();

/**
 * @swagger
 * tags:
 *   - name: behaviors
 *     description: User behavior tracking
 *   - name: recommendations
 *     description: Personalized product recommendations
 */

/**
 * @swagger
 * /api/behaviors:
 *   post:
 *     tags: [behaviors]
 *     summary: Record a user behavior event
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, productId, eventType]
 *             properties:
 *               userId:
 *                 type: string
 *               productId:
 *                 type: string
 *               eventType:
 *                 type: string
 *                 enum: [view, add_to_cart, buy_now, purchased]
 *     responses:
 *       200:
 *         description: Event recorded
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
behaviorRouter.post("/", recordBehavior);

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *     tags: [recommendations]
 *     summary: Get personalized product recommendations for a user
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of recommended products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       400:
 *         description: Missing userId
 *       500:
 *         description: Server error
 */
recommendationRouter.get("/", getRecommendations);

export { behaviorRouter, recommendationRouter };
