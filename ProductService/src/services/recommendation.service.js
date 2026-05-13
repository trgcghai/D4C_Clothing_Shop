import { behaviorModel } from "../models/behavior.model.js";
import { recommendationModel } from "../models/recommendation.model.js";
import { productService } from "./product.service.js";

// ─── Behavior event weights ────────────────────────────────────────────────────
const EVENT_WEIGHTS = {
  view: 1,
  add_to_cart: 3,
  buy_now: 5,
  purchased: 10,
};

// Minimum scored products before we stop showing cold-start fallback
const COLD_START_THRESHOLD = 3;

class RecommendationService {
  /**
   * Record a user behavior event and update the score for that product.
   * @param {string} userId
   * @param {string} productId
   * @param {"view"|"add_to_cart"|"buy_now"|"purchased"} eventType
   */
  async recordBehavior(userId, productId, eventType) {
    const weight = EVENT_WEIGHTS[eventType];
    if (weight === undefined) {
      throw new Error(
        `eventType không hợp lệ. Chấp nhận: ${Object.keys(EVENT_WEIGHTS).join(", ")}`
      );
    }

    // Fire-and-forget parallel: record event + update score
    const [event] = await Promise.all([
      behaviorModel.putEvent({ userId, productId, eventType }),
      recommendationModel.upsertScore(userId, productId, weight),
    ]);

    return event;
  }

  /**
   * Get personalised recommendations for a user.
   * Algorithm:
   *   1. Fetch top-scored (userId, productId) pairs from d4c_user_scores
   *   2. For each top product, find similar products (same category/brand/gender)
   *      that the user has NOT interacted with yet
   *   3. Deduplicate and rank candidates by how many top-products they are similar to
   *   4. Cold-start fallback → featured products when user has < COLD_START_THRESHOLD scored products
   *
   * @param {string} userId
   * @param {number} limit
   * @returns {Promise<Product[]>}
   */
  async getRecommendations(userId, limit = 10) {
    // 1. Get user's top-scored products
    const topScores = await recommendationModel.findTopByUserId(userId, 10);

    // Cold start – not enough data yet
    if (topScores.length < COLD_START_THRESHOLD) {
      return productService.getFeaturedProducts();
    }

    // 2. Build set of already-interacted product IDs
    const interactedIds = new Set(topScores.map((s) => s.productId));

    // 3. Fetch full details for top-scored products
    const topProducts = await Promise.all(
      topScores.map((s) =>
        productService.getProductById(s.productId).catch(() => null)
      )
    );
    const validTopProducts = topProducts.filter(Boolean);

    // 4. Collect preference signals
    const preferredCategories = new Set();
    const preferredBrands = new Set();
    const preferredGenders = new Set();

    for (const p of validTopProducts) {
      if (p.categoryId) preferredCategories.add(p.categoryId);
      if (p.brand) preferredBrands.add(p.brand.toLowerCase());
      if (p.gender) preferredGenders.add(p.gender.toLowerCase());
    }

    // 5. Get all products, score candidates by preference overlap
    const allProductsResult = await productService.getAllProducts();
    const allProducts = Array.isArray(allProductsResult)
      ? allProductsResult
      : allProductsResult.data || [];

    const scored = allProducts
      .filter((p) => !interactedIds.has(p.id)) // exclude already interacted
      .map((p) => {
        let candidateScore = 0;
        if (preferredCategories.has(p.categoryId)) candidateScore += 3;
        if (preferredBrands.has((p.brand || "").toLowerCase())) candidateScore += 2;
        if (preferredGenders.has((p.gender || "").toLowerCase())) candidateScore += 1;
        return { product: p, candidateScore };
      })
      .filter((x) => x.candidateScore > 0) // only relevant ones
      .sort((a, b) => b.candidateScore - a.candidateScore)
      .slice(0, limit)
      .map((x) => x.product);

    // If still not enough results, supplement with featured products
    if (scored.length < limit) {
      const featured = await productService.getFeaturedProducts();
      const supplemented = featured.filter(
        (p) => !interactedIds.has(p.id) && !scored.find((s) => s.id === p.id)
      );
      return [...scored, ...supplemented].slice(0, limit);
    }

    return scored;
  }
}

export const recommendationService = new RecommendationService();
