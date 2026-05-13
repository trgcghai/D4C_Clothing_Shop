import { productService } from "../services/product.service.js";

// ─── Browsing & Listing ────────────────────────────────────────────────────────

/**
 * GET /api/products
 * Query: category, gender, size, color, brand, minPrice, maxPrice,
 *        sort_by, sort_order, page, limit
 */
export const getAllProducts = async (req, res) => {
  try {
    const result = await productService.getProductsWithFilters(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi get products:", error);
    res.status(500).json({ message: "Lỗi server khi lấy dữ liệu sản phẩm", error: error.message });
  }
};

/**
 * GET /api/products/featured
 */
export const getFeaturedProducts = async (req, res) => {
  try {
    const products = await productService.getFeaturedProducts();
    res.status(200).json(products);
  } catch (error) {
    console.error("Lỗi get featured products:", error);
    res.status(500).json({ message: "Lỗi server khi lấy sản phẩm nổi bật", error: error.message });
  }
};

/**
 * GET /api/products/new-arrivals?limit=8
 */
export const getNewArrivals = async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 8;
    const products = await productService.getNewArrivals(limit);
    res.status(200).json(products);
  } catch (error) {
    console.error("Lỗi get new arrivals:", error);
    res.status(500).json({ message: "Lỗi server khi lấy hàng mới về", error: error.message });
  }
};

// ─── Search ────────────────────────────────────────────────────────────────────

/**
 * GET /api/products/search?q=keyword&page=1&limit=12&sort_by=createdAt&sort_order=desc
 */
export const searchProducts = async (req, res) => {
  try {
    const { q, ...options } = req.query;
    if (!q || q.trim() === "") {
      return res.status(400).json({ message: "Vui lòng nhập từ khóa tìm kiếm" });
    }
    const result = await productService.searchProducts(q.trim(), options);
    res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi search products:", error);
    res.status(500).json({ message: "Lỗi server khi tìm kiếm sản phẩm", error: error.message });
  }
};

// ─── Single Product ────────────────────────────────────────────────────────────

/**
 * GET /api/products/:id
 */
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error("Lỗi get product by id:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

/**
 * GET /api/products/:id/related
 */
export const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const products = await productService.getRelatedProducts(id);
    res.status(200).json(products);
  } catch (error) {
    console.error("Lỗi get related products:", error);
    res.status(500).json({ message: "Lỗi server khi lấy sản phẩm liên quan", error: error.message });
  }
};

// ─── Admin CRUD ────────────────────────────────────────────────────────────────

/**
 * POST /api/products
 */
export const createNewProduct = async (req, res) => {
  try {
    const productData = req.body;
    const file = req.file;
    const newProduct = await productService.createProduct(productData, file);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Lỗi tạo sản phẩm:", error);
    res.status(500).json({ message: "Lỗi khi tạo sản phẩm mới", error: error.message });
  }
};

/**
 * PUT /api/products/:id
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productData = req.body;
    const file = req.file;
    const updatedProduct = await productService.updateProduct(id, productData, file);
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Lỗi cập nhật sản phẩm:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật sản phẩm", error: error.message });
  }
};

/**
 * DELETE /api/products/:id
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await productService.deleteProduct(id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi xóa sản phẩm:", error);
    res.status(500).json({ message: "Lỗi khi xóa sản phẩm", error: error.message });
  }
};

// ─── Stock Management ──────────────────────────────────────────────────────────

/**
 * POST /api/products/variants/:variantId/deduct-stock
 * Body: { quantity: number }
 */
export const deductStock = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ message: "Số lượng phải là số nguyên dương" });
    }

    const result = await productService.deductVariantStock(variantId, quantity);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith("Không đủ tồn kho")) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Lỗi trừ tồn kho:", error);
    res.status(500).json({ message: "Lỗi khi trừ tồn kho", error: error.message });
  }
};

/**
 * POST /api/products/variants/:variantId/restore-stock
 * Body: { quantity: number }
 */
export const restoreStock = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ message: "Số lượng phải là số nguyên dương" });
    }

    const result = await productService.restoreVariantStock(variantId, quantity);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.includes("không tồn tại")) {
      return res.status(404).json({ message: error.message });
    }
    console.error("Lỗi hoàn tồn kho:", error);
    res.status(500).json({ message: "Lỗi khi hoàn tồn kho", error: error.message });
  }
};
