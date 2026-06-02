import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

// Ưu tiên lấy từ biến môi trường, nếu không có thì dùng mặc định (phù hợp cho local docker)
const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = process.env.REDIS_PORT || "6379";

const redisClient = createClient({
  url: `redis://${redisHost}:${redisPort}`,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

await redisClient.connect();

export { redisClient };
