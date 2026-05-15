import express from "express";
import { chatController } from "../controllers/chat.controller.js";

const router = express.Router();

// GET /api/v1/ai/chat — fetch conversation
router.get("/chat", chatController.getConversation);

// POST /api/v1/ai/chat — send message
router.post("/chat", chatController.processMessage);

// DELETE /api/v1/ai/chat — clear conversation
router.delete("/chat", chatController.clearConversation);

export default router;
