import express from "express";
import { uploadImage } from "../middlewares/upload.middleware.js";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:id", getCategoryById);
router.post("/", uploadImage.single("categoryImage"), createCategory);
router.put("/:id", uploadImage.single("categoryImage"), updateCategory);
router.delete("/:id", deleteCategory);

export default router;
