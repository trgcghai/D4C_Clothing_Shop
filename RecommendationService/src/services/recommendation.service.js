import { behaviorModel } from "../models/behavior.model.js";
import { recommendationModel } from "../models/recommendation.model.js";
import { productServiceClient } from "../config/product-service-client.js";

const EVENT_WEIGHTS = {
  view: 1,
  add_to_cart: 3,
  buy_now: 5,
  purchased: 10,
};

const COLD_START_THRESHOLD = 3;

class RecommendationService {
  async recordBehavior(userId, productId, eventType) {
    const weight = EVENT_WEIGHTS[eventType];
    if (weight === undefined) {
      throw new Error(
        `eventType không hợp lệ. Chấp nhận: ${Object.keys(EVENT_WEIGHTS).join(", ")}`
      );
    }

    const [event] = await Promise.all([
      behaviorModel.putEvent({ userId, productId, eventType }),
      recommendationModel.upsertScore(userId, productId, weight),
    ]);

    return event;
  }

  async getRecommendations(userId, limit = 10) {
    const topScores = await recommendationModel.findTopByUserId(userId, 10);

    if (topScores.length < COLD_START_THRESHOLD) {
      const res = await productServiceClient.get("/api/products/featured");
      return res.data;
    }

    const interactedIds = new Set(topScores.map((s) => s.productId));

    const topProducts = await Promise.all(
      topScores.map((s) =>
        productServiceClient
          .get(`/api/products/${s.productId}`)
          .then((res) => res.data)
          .catch(() => null)
      )
    );
    const validTopProducts = topProducts.filter(Boolean);

    const preferredCategories = new Set();
    const preferredBrands = new Set();
    const preferredGenders = new Set();

    for (const p of validTopProducts) {
      if (p.categoryId) preferredCategories.add(p.categoryId);
      if (p.brand) preferredBrands.add(p.brand.toLowerCase());
      if (p.gender) preferredGenders.add(p.gender.toLowerCase());
    }

    const allRes = await productServiceClient.get("/api/products");
    const allProducts = allRes.data.data || [];

    const scored = allProducts
      .filter((p) => !interactedIds.has(p.id))
      .map((p) => {
        let candidateScore = 0;
        if (preferredCategories.has(p.categoryId)) candidateScore += 3;
        if (preferredBrands.has((p.brand || "").toLowerCase())) candidateScore += 2;
        if (preferredGenders.has((p.gender || "").toLowerCase())) candidateScore += 1;
        return { product: p, candidateScore };
      })
      .filter((x) => x.candidateScore > 0)
      .sort((a, b) => b.candidateScore - a.candidateScore)
      .slice(0, limit)
      .map((x) => x.product);

    if (scored.length < limit) {
      const featuredRes = await productServiceClient.get("/api/products/featured");
      const featured = featuredRes.data;
      const supplemented = featured.filter(
        (p) => !interactedIds.has(p.id) && !scored.find((s) => s.id === p.id)
      );
      return [...scored, ...supplemented].slice(0, limit);
    }

    return scored;
  }
}

export const recommendationService = new RecommendationService();
