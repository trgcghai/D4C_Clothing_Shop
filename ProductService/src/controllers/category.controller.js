import { categoryService } from "../services/category.service.js";
import { publishCategoryEvent } from "../services/event-publisher.service.js";

export const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories();
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.status(200).json(category);
  } catch (error) {
    console.error("Error getting category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const data = req.body;
    const file = req.file;
    const newCategory = await categoryService.createCategory(data, file);
    publishCategoryEvent("CREATE", newCategory);
    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const file = req.file;
    const updated = await categoryService.updateCategory(id, data, file);
    publishCategoryEvent("UPDATE", updated);
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating category:", error);
    if (error.message === "Category not found") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await categoryService.deleteCategory(id);
    publishCategoryEvent("DELETE", { id });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error deleting category:", error);
    if (error.message === "Category not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes("associated with it")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
