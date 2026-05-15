import express from "express";
import {
  clearConversation,
  getConversation,
  processMessage,
} from "../controllers/chat.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @openapi
 * /api/v1/ai/chat:
 *   get:
 *     tags: [chat]
 *     summary: Fetch conversation history
 *     description: Retrieve all messages for the current user's conversation from Redis. Identity is extracted from Gateway-injected X-User-* headers.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Conversation messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationResponse'
 *       401:
 *         description: Missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/chat", requireAuth, getConversation);

/**
 * @openapi
 * /api/v1/ai/chat:
 *   post:
 *     tags: [chat]
 *     summary: Send a message and get AI response
 *     description: Send a user message to the AI assistant. The AI may call tools (product search, cart operations, admin stats) before responding. Identity is extracted from Gateway-injected X-User-* headers.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Tìm áo thun nam size L"
 *                 description: The user's message text
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Message is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/chat", requireAuth, processMessage);

/**
 * @openapi
 * /api/v1/ai/chat:
 *   delete:
 *     tags: [chat]
 *     summary: Clear conversation history
 *     description: Delete all messages for the current user's conversation from Redis. Identity is extracted from Gateway-injected X-User-* headers.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Conversation cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClearResponse'
 *       401:
 *         description: Missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/chat", requireAuth, clearConversation);

export default router;
