import express from "express";
import { chatController } from "../controllers/chat.controller.js";

const router = express.Router();

// POST /api/v1/ai/chat
router.post("/chat", chatController.processMessage);

export default router;
