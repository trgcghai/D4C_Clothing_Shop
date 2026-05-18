import { searchCategories } from "../services/category.service.js";

export const handleCategorySearch = async (req, res) => {
  try {
    const { q, page, limit, sort_by } = req.query;

    const options = {};
    if (q && q.trim() !== "") options.q = q.trim();
    if (page) options.page = page;
    if (limit) options.limit = limit;
    if (sort_by) options.sort_by = sort_by;

    const result = await searchCategories(options);
    res.status(200).json(result);
  } catch (error) {
    console.error("Category search error:", error);
    res.status(503).json({
      message: "Category search service temporarily unavailable",
    });
  }
};
