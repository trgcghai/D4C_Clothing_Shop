import { geminiService } from "../services/gemini.service.js";
import redisClient from "../config/redis.config.js";

const extractIdentity = (req, res) => {
  const userId = req.headers["x-user-id"];
  const rolesHeader = req.headers["x-user-roles"] || "";
  const roles = rolesHeader
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const role = roles.length > 0 ? roles[0].toUpperCase() : "USER";

  if (!userId) {
    return null;
  }

  return { userId, role };
};

const getConversation = async (req, res) => {
  try {
    const { userId, role } = extractIdentity(req);
    const redisKey = `ai_session:${role.toLowerCase()}:${userId}`;

    const contextStr = await redisClient.get(redisKey);
    const messages = contextStr ? JSON.parse(contextStr) : [];

    return res.status(200).json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    console.error("Get Conversation Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const processMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const { userId, role } = extractIdentity(req);

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const responseText = await geminiService.processChat(userId, role, message);

    return res.status(200).json({
      success: true,
      data: {
        reply: responseText,
        role: role,
      },
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const clearConversation = async (req, res) => {
  try {
    const { userId, role } = extractIdentity(req);
    const redisKey = `ai_session:${role.toLowerCase()}:${userId}`;

    await redisClient.del(redisKey);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Clear Conversation Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export { getConversation, processMessage, clearConversation };
