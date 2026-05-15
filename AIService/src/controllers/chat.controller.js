import { geminiService } from "../services/gemini.service.js";

class ChatController {
  async processMessage(req, res) {
    try {
      const { message } = req.body;
      
      // In a real application, userId and role should be extracted from the JWT token via a middleware
      // For testing, we allow them in the body, defaulting to a dummy user and CUSTOMER role
      const userId = req.user?.id || req.body.userId || "anonymous";
      const role = req.user?.role || req.body.role || "USER";

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const responseText = await geminiService.processChat(userId, role, message);

      return res.status(200).json({
        success: true,
        data: {
          reply: responseText,
          role: role
        }
      });
    } catch (error) {
      console.error("Chat Controller Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const chatController = new ChatController();
