import { searchProducts, buildFilterString } from "../services/search.service.js";

export const handleSearch = async (req, res) => {
  try {
    const { q, page, limit, filter_by, sort_by, category, brand, priceMin, priceMax, size, color } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        message: "Vui long nhap tu khoa tim kiem",
      });
    }

    const dynamicFilter = buildFilterString({
      filter_by,
      category,
      brand,
      priceMin,
      priceMax,
      size,
      color,
    });

    const options = {};
    if (page) options.page = page;
    if (limit) options.limit = limit;
    options.filter_by = dynamicFilter || filter_by;
    if (sort_by) options.sort_by = sort_by;

    const result = await searchProducts(q.trim(), options);
    res.status(200).json(result);
  } catch (error) {
    console.error("Search error:", error);
    res.status(503).json({
      message: "Search service temporarily unavailable",
    });
  }
};
