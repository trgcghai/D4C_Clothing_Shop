import express from "express";
import {
  recordBehavior,
  getRecommendations,
} from "../controllers/recommendation.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const recommendationRouter = express.Router();

recommendationRouter.post("/behaviors", requireAuth, recordBehavior);
recommendationRouter.get("/", requireAuth, getRecommendations);

export { recommendationRouter };
