import redisClient from "../config/redis.config.js";

const KEY_PREFIX = "ratelimit:aiservice:chat:user:";
const LIMIT = 10;
const WINDOW_MS = 60000;

export const rateLimiter = async (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return next();
  }

  const key = KEY_PREFIX + userId;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  try {
    await redisClient.zadd(key, now, `${now}`);
    await redisClient.zremrangebyscore(key, 0, windowStart);
    const count = await redisClient.zcount(key, windowStart, now);
    await redisClient.expire(key, 60);

    if (count > LIMIT) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: 30,
      });
    }
  } catch (err) {
    console.warn("[RateLimiter] Redis unavailable, allowing request through:", err.message);
    return next(); // Fail-open
  }

  next();
};
