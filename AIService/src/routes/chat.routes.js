import express from "express";
import { chatController } from "../controllers/chat.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// GET /api/v1/ai/chat — fetch conversation
router.get("/chat", requireAuth, chatController.getConversation.bind(chatController));

// POST /api/v1/ai/chat — send message
router.post("/chat", requireAuth, chatController.processMessage.bind(chatController));

// DELETE /api/v1/ai/chat — clear conversation
router.delete("/chat", requireAuth, chatController.clearConversation.bind(chatController));

export default router;
