import { cacheGet, cacheSet, TTL } from "../services/cache.service.js";
import { keys } from "../services/cache.service.js";

export const getCachedRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;
    const cached = await cacheGet(keys.recommendations(userId));
    if (!cached) {
      return res.status(404).json({ message: "No cached recommendations found" });
    }
    res.status(200).json(cached);
  } catch (error) {
    console.error("[Cache] GET recommendations error:", error);
    res.status(500).json({ message: "Cache error", error: error.message });
  }
};

export const cacheRecommendations = async (req, res) => {
  try {
    const { userId, data } = req.body;
    if (!userId || !data || !Array.isArray(data)) {
      return res.status(400).json({ message: "userId and data array are required" });
    }
    await cacheSet(keys.recommendations(userId), data, TTL.RECOMMENDATIONS);
    res.status(200).json({ message: "Recommendations cached", userId });
  } catch (error) {
    console.error("[Cache] SET recommendations error:", error);
    res.status(500).json({ message: "Cache error", error: error.message });
  }
};
