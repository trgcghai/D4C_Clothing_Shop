import express from "express";
import { handleCategorySearch } from "../controllers/category.controller.js";

const router = express.Router();

router.get("/", handleCategorySearch);

export default router;
