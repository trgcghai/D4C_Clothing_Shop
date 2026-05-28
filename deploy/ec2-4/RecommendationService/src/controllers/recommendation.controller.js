import { recommendationService } from "../services/recommendation.service.js";

export const recordBehavior = async (req, res) => {
  try {
    const { userId, productId, eventType } = req.body;

    if (!userId || !productId || !eventType) {
      return res.status(400).json({
        message: "Thiếu tham số bắt buộc: userId, productId, eventType",
      });
    }

    const event = await recommendationService.recordBehavior(
      userId,
      productId,
      eventType
    );
    res.status(200).json({ success: true, event });
  } catch (error) {
    if (error.message.startsWith("eventType không hợp lệ")) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Lỗi ghi behavior:", error);
    res.status(500).json({ message: "Lỗi server khi ghi hành vi", error: error.message });
  }
};

export const getRecommendations = async (req, res) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "Thiếu tham số userId" });
    }

    const limitNum = Math.min(48, Math.max(1, Number(limit) || 10));
    const products = await recommendationService.getRecommendations(userId, limitNum);
    res.status(200).json(products);
  } catch (error) {
    console.error("Lỗi lấy recommendations:", error);
    res.status(500).json({
      message: "Lỗi server khi lấy sản phẩm đề xuất",
      error: error.message,
    });
  }
};
