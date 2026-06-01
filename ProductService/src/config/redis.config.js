import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
  url: "redis://redis:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

await redisClient.connect();

export { redisClient };
