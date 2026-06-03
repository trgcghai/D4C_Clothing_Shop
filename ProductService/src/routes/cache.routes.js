import express from "express";
import { getCachedRecommendations, cacheRecommendations } from "../controllers/cache.controller.js";

const router = express.Router();

router.get("/recommendations/:userId", getCachedRecommendations);
router.post("/recommendations", cacheRecommendations);

export default router;
