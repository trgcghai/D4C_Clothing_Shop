import { redisClient } from "../config/redis.config.js";
import crypto from "crypto";

export const TTL = {
  FEATURED: 600,
  NEW_ARRIVALS: 300,
  DETAIL: 900,
  RELATED: 600,
  LIST: 600,
  RECOMMENDATIONS: 1800,
};

export const keys = {
  featured: () => "product:featured",
  newArrivals: (limit) => `product:new-arrivals:${limit}`,
  detail: (productId) => `product:detail:${productId}`,
  related: (productId) => `product:related:${productId}`,
  list: (filters) => {
    const sorted = Object.keys(filters)
      .sort()
      .map((k) => `${k}=${filters[k]}`)
      .join("&");
    const hash = crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
    return `product:list:${hash}`;
  },
  recommendations: (userId) => `product:recommendations:${userId}`,
};

export async function cacheGet(key) {
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error("[Cache] GET error:", err.message);
    return null;
  }
}

export async function cacheSet(key, data, ttl) {
  try {
    await redisClient.set(key, JSON.stringify(data), { EX: ttl });
  } catch (err) {
    console.error("[Cache] SET error:", err.message);
  }
}

export async function cacheDel(key) {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error("[Cache] DEL error:", err.message);
  }
}

export async function cacheDelPattern(pattern) {
  try {
    const keys = [];
    let cursor = 0;
    do {
      const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error("[Cache] DEL pattern error:", err.message);
  }
}
