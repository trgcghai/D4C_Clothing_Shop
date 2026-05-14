import express from "express";
import {
  recordBehavior,
  getRecommendations,
} from "../controllers/recommendation.controller.js";

const recommendationRouter = express.Router();

recommendationRouter.post("/behaviors", recordBehavior);
recommendationRouter.get("/", getRecommendations);

export { recommendationRouter };
