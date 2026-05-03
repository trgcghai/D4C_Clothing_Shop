import { productModel } from "../models/product.model.js";
import { s3Client } from "../config/aws.config.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const BUCKET_NAME = process.env.BUCKET_NAME || "d4c-clothingshop-products-bucket";
const REGION = process.env.AWS_REGION || "ap-southeast-1";

class ProductService {
  /**
   * Get all products (no filter) — legacy, kept for admin use
   */
  async getAllProducts() {
    return await productModel.findAll();
  }

  /**
   * Get products with filters + sorting + pagination
   * @param {Object} query - request query params
   * @returns {{ data: Array, total: number, page: number, limit: number, totalPages: number }}
   */
  async getProductsWithFilters(query = {}) {
    const {
      category,
      gender,
      size,
      color,
      brand,
      minPrice,
      maxPrice,
      sort_by = "createdAt",
      sort_order = "desc",
      page = 1,
      limit = 12,
    } = query;

    // Build filters object
    const filters = {};
    if (category) filters.category = category;
    if (gender) filters.gender = gender;
    if (size) filters.size = size;
    if (color) filters.color = color;
    if (brand) filters.brand = brand;
    if (minPrice !== undefined && minPrice !== "") filters.minPrice = minPrice;
    if (maxPrice !== undefined && maxPrice !== "") filters.maxPrice = maxPrice;

    let items = await productModel.findWithFilters(filters);

    // Sort — featured products always float to the top first,
    // then apply the chosen sort key as a secondary tiebreaker.
    const allowedSorts = ["name", "price", "createdAt"];
    const sortKey = allowedSorts.includes(sort_by) ? sort_by : "createdAt";
    const orderMultiplier = sort_order === "asc" ? 1 : -1;

    items.sort((a, b) => {
      // Primary: isFeatured = true comes before isFeatured = false
      const aFeatured = a.isFeatured === true ? 1 : 0;
      const bFeatured = b.isFeatured === true ? 1 : 0;
      if (bFeatured !== aFeatured) return bFeatured - aFeatured;

      // Secondary: user-chosen sort key
      if (sortKey === "name") {
        return orderMultiplier * (a.name || "").localeCompare(b.name || "", "vi");
      }
      if (sortKey === "price") {
        return orderMultiplier * (Number(a.price) - Number(b.price));
      }
      if (sortKey === "createdAt") {
        return orderMultiplier * (new Date(a.createdAt) - new Date(b.createdAt));
      }
      return 0;
    });

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const total = items.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIdx = (pageNum - 1) * limitNum;
    const data = items.slice(startIdx, startIdx + limitNum);

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  }

  /**
   * Search products by keyword (name, description, category, brand, tags)
   * @param {string} keyword
   * @param {Object} options - { sort_by, sort_order, page, limit }
   */
  async searchProducts(keyword, options = {}) {
    const {
      sort_by = "createdAt",
      sort_order = "desc",
      page = 1,
      limit = 12,
    } = options;

    let items = await productModel.findByKeyword(keyword);

    // Sort
    const allowedSorts = ["name", "price", "createdAt"];
    const sortKey = allowedSorts.includes(sort_by) ? sort_by : "createdAt";
    const orderMultiplier = sort_order === "asc" ? 1 : -1;

    items.sort((a, b) => {
      if (sortKey === "name") return orderMultiplier * (a.name || "").localeCompare(b.name || "", "vi");
      if (sortKey === "price") return orderMultiplier * (Number(a.price) - Number(b.price));
      if (sortKey === "createdAt") return orderMultiplier * (new Date(a.createdAt) - new Date(b.createdAt));
      return 0;
    });

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const total = items.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIdx = (pageNum - 1) * limitNum;
    const data = items.slice(startIdx, startIdx + limitNum);

    return { data, total, page: pageNum, limit: limitNum, totalPages, keyword };
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts() {
    return await productModel.findFeatured();
  }

  /**
   * Get new arrivals (latest products)
   * @param {number} limit
   */
  async getNewArrivals(limit = 8) {
    return await productModel.findLatest(limit);
  }

  /**
   * Get related products (same category, exclude self)
   * @param {string} productId
   */
  async getRelatedProducts(productId) {
    const product = await productModel.findById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm");
    return await productModel.findRelated(product.category, productId, 6);
  }

  async getProductById(id) {
    return await productModel.findById(id);
  }

  async createProduct(data, file) {
    let imageUrl = data.imageUrl || "";

    if (file) {
      const fileKey = `products/${Date.now()}-${uuidv4()}-${file.originalname.replace(/\s/g, "-")}`;
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      await s3Client.send(new PutObjectCommand(uploadParams));
      imageUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileKey}`;
    }

    // Parse colors and tags if they come as JSON strings from FormData
    let colors = data.colors || [];
    if (typeof colors === "string") {
      try { colors = JSON.parse(colors); } catch { colors = colors.split(",").map((c) => c.trim()); }
    }

    let tags = data.tags || [];
    if (typeof tags === "string") {
      try { tags = JSON.parse(tags); } catch { tags = tags.split(",").map((t) => t.trim()); }
    }

    const newProduct = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      price: Number(data.price),
      stock: typeof data.stock === "string" ? JSON.parse(data.stock) : data.stock,
      category: data.category,
      gender: data.gender || "Unisex",
      brand: data.brand || "D4C",
      colors,
      tags,
      isFeatured: data.isFeatured === "true" || data.isFeatured === true || false,
      imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await productModel.create(newProduct);
  }

  async updateProduct(id, data, file) {
    const existingProduct = await productModel.findById(id);
    if (!existingProduct) throw new Error("Không tìm thấy sản phẩm");

    let imageUrl = existingProduct.imageUrl;

    if (file) {
      // Delete old image from S3
      if (existingProduct.imageUrl && existingProduct.imageUrl.includes(BUCKET_NAME)) {
        try {
          const oldKey = existingProduct.imageUrl.split(".amazonaws.com/")[1];
          if (oldKey) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: decodeURIComponent(oldKey) }));
          }
        } catch (e) {
          console.error("Lỗi khi xóa ảnh S3 cũ:", e);
        }
      }

      const fileKey = `products/${Date.now()}-${uuidv4()}-${file.originalname.replace(/\s/g, "-")}`;
      const uploadParams = { Bucket: BUCKET_NAME, Key: fileKey, Body: file.buffer, ContentType: file.mimetype };
      await s3Client.send(new PutObjectCommand(uploadParams));
      imageUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileKey}`;
    }

    let colors = data.colors !== undefined ? data.colors : existingProduct.colors;
    if (typeof colors === "string") {
      try { colors = JSON.parse(colors); } catch { colors = colors.split(",").map((c) => c.trim()); }
    }

    let tags = data.tags !== undefined ? data.tags : existingProduct.tags;
    if (typeof tags === "string") {
      try { tags = JSON.parse(tags); } catch { tags = tags.split(",").map((t) => t.trim()); }
    }

    const updateData = {
      name: data.name || existingProduct.name,
      description: data.description || existingProduct.description,
      price: data.price ? Number(data.price) : existingProduct.price,
      stock: data.stock ? (typeof data.stock === "string" ? JSON.parse(data.stock) : data.stock) : existingProduct.stock,
      category: data.category || existingProduct.category,
      gender: data.gender || existingProduct.gender || "Unisex",
      brand: data.brand || existingProduct.brand || "D4C",
      colors,
      tags,
      isFeatured: data.isFeatured !== undefined
        ? (data.isFeatured === "true" || data.isFeatured === true)
        : (existingProduct.isFeatured || false),
      imageUrl,
      updatedAt: new Date().toISOString(),
    };

    return await productModel.update(id, updateData);
  }

  async deleteProduct(id) {
    const existingProduct = await productModel.findById(id);
    if (!existingProduct) throw new Error("Không tìm thấy sản phẩm");

    if (existingProduct.imageUrl && existingProduct.imageUrl.includes(BUCKET_NAME)) {
      try {
        const key = existingProduct.imageUrl.split(".amazonaws.com/")[1];
        if (key) {
          await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: decodeURIComponent(key) }));
        }
      } catch (e) {
        console.error("Lỗi khi xóa ảnh S3:", e);
      }
    }

    await productModel.remove(id);
    return { success: true, message: "Đã xóa sản phẩm thành công" };
  }
}

export const productService = new ProductService();
