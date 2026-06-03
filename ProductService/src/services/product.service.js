import { productModel } from "../models/product.model.js";
import { variantModel } from "../models/variant.model.js";
import { categoryModel } from "../models/category.model.js";
import { s3Client } from "../config/aws.config.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { publishProductEvent } from "./event-publisher.service.js";
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, TTL, keys } from "./cache.service.js";

dotenv.config();

const BUCKET_NAME = process.env.BUCKET_NAME || "d4c-clothingshop-products-bucket";
const REGION = process.env.AWS_REGION || "ap-southeast-1";

class ProductService {
  async _populateRelations(product) {
    if (!product) return product;
    product.variants = await variantModel.findByProductId(product.id);
    if (product.categoryId) {
      const cat = await categoryModel.findById(product.categoryId);
      product.category = cat ? cat.name : null;
    }
    return product;
  }

  async getAllProducts() {
    const products = await productModel.findAll();
    return Promise.all(products.map(p => this._populateRelations(p)));
  }

  async getProductsWithFilters(query = {}) {
    const {
      category,
      categoryId,
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

    // ── Performance: bulk-fetch ALL variants & categories in 2 parallel calls ──
    const [allVariants, allCategories] = await Promise.all([
      variantModel.findAll(),
      categoryModel.findAll(),
    ]);

    // Build lookup maps for O(1) access
    const variantsByProductId = {};
    for (const v of allVariants) {
      if (!variantsByProductId[v.productId]) variantsByProductId[v.productId] = [];
      variantsByProductId[v.productId].push(v);
    }
    const categoryById = {};
    const categoryByName = {};
    for (const c of allCategories) {
      categoryById[c.id] = c;
      categoryByName[c.name.toLowerCase()] = c;
    }
    // ───────────────────────────────────────────────────────────────────────────

    const filters = {};
    let catId = categoryId;
    if (!catId && category) {
      const matchedCat = categoryByName[category.toLowerCase()];
      catId = matchedCat ? matchedCat.id : "not-found";
    }
    if (catId) filters.categoryId = catId;
    if (gender) filters.gender = gender;
    if (brand) filters.brand = brand;
    if (minPrice !== undefined && minPrice !== "") filters.minPrice = minPrice;
    if (maxPrice !== undefined && maxPrice !== "") filters.maxPrice = maxPrice;

    let items = await productModel.findWithFilters(filters);

    const sizes = size ? size.split(",").map((s) => s.trim()) : [];
    const colors = color ? color.split(",").map((c) => c.trim().toLowerCase()) : [];

    const populatedItems = [];
    for (const item of items) {
      const variants = variantsByProductId[item.id] || [];

      let match = true;
      if (sizes.length > 0) {
        match = match && variants.some(v => sizes.includes(v.size) && Number(v.quantity) > 0);
      }
      if (colors.length > 0) {
        match = match && variants.some(v => colors.includes(v.color.toLowerCase()));
      }

      if (match) {
        item.variants = variants;
        item.category = categoryById[item.categoryId]?.name || null;
        populatedItems.push(item);
      }
    }

    items = populatedItems;

    const allowedSorts = ["name", "price", "createdAt"];
    const sortKey = allowedSorts.includes(sort_by) ? sort_by : "createdAt";
    const orderMultiplier = sort_order === "asc" ? 1 : -1;

    items.sort((a, b) => {
      const aFeatured = a.isFeatured === true ? 1 : 0;
      const bFeatured = b.isFeatured === true ? 1 : 0;
      if (bFeatured !== aFeatured) return bFeatured - aFeatured;

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

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const total = items.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIdx = (pageNum - 1) * limitNum;
    const data = items.slice(startIdx, startIdx + limitNum);

    return { data, total, page: pageNum, limit: limitNum, totalPages };
  }

  async searchProducts(keyword, options = {}) {
    const { sort_by = "createdAt", sort_order = "desc", page = 1, limit = 12 } = options;
    let items = await productModel.findByKeyword(keyword);

    const populatedItems = [];
    for (const item of items) {
      populatedItems.push(await this._populateRelations(item));
    }
    items = populatedItems;

    const allowedSorts = ["name", "price", "createdAt"];
    const sortKey = allowedSorts.includes(sort_by) ? sort_by : "createdAt";
    const orderMultiplier = sort_order === "asc" ? 1 : -1;

    items.sort((a, b) => {
      if (sortKey === "name") return orderMultiplier * (a.name || "").localeCompare(b.name || "", "vi");
      if (sortKey === "price") return orderMultiplier * (Number(a.price) - Number(b.price));
      if (sortKey === "createdAt") return orderMultiplier * (new Date(a.createdAt) - new Date(b.createdAt));
      return 0;
    });

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const total = items.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIdx = (pageNum - 1) * limitNum;
    const data = items.slice(startIdx, startIdx + limitNum);

    return { data, total, page: pageNum, limit: limitNum, totalPages, keyword };
  }

  async getFeaturedProducts() {
    const cacheKey = keys.featured();
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const items = await productModel.findFeatured();
    const result = await Promise.all(items.map(p => this._populateRelations(p)));
    await cacheSet(cacheKey, result, TTL.FEATURED);
    return result;
  }

  async getNewArrivals(limit = 8) {
    const items = await productModel.findLatest(limit);
    return Promise.all(items.map(p => this._populateRelations(p)));
  }

  async getRelatedProducts(productId) {
    const product = await productModel.findById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm");
    const items = await productModel.findRelated(product.categoryId, productId, 6);
    return Promise.all(items.map(p => this._populateRelations(p)));
  }

  async getProductById(id) {
    const product = await productModel.findById(id);
    return await this._populateRelations(product);
  }

  async createProduct(data, file) {
    if (data.categoryId) {
      const category = await categoryModel.findById(data.categoryId);
      if (!category) throw new Error("Danh mục không tồn tại");
    }

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

    let tags = data.tags || [];
    if (typeof tags === "string") {
      try { tags = JSON.parse(tags); } catch { tags = tags.split(",").map((t) => t.trim()); }
    }
    
    let variants = data.variants || [];
    if (typeof variants === "string") {
      try { variants = JSON.parse(variants); } catch (e) { variants = []; }
    }

    const newProduct = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      price: Number(data.price),
      categoryId: data.categoryId,
      gender: data.gender || "Unisex",
      brand: data.brand || "D4C",
      tags,
      isFeatured: data.isFeatured === "true" || data.isFeatured === true || false,
      imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await productModel.create(newProduct);

    // Create variants
    for (const v of variants) {
      await variantModel.create({
        id: uuidv4(),
        productId: newProduct.id,
        color: v.color || "",
        size: v.size || "",
        quantity: Number(v.quantity) || 0,
        sku: v.sku || `${newProduct.id}-${v.color}-${v.size}`.replace(/\s/g, "-")
      });
    }

    const populated = await this._populateRelations(newProduct);
    publishProductEvent("CREATE", {
      id: newProduct.id,
      name: newProduct.name,
      description: newProduct.description,
      price: newProduct.price,
      categoryId: newProduct.categoryId,
      category: populated.category,
      brand: newProduct.brand,
      gender: newProduct.gender,
      tags: newProduct.tags,
      imageUrl: newProduct.imageUrl,
      isFeatured: newProduct.isFeatured,
      createdAt: newProduct.createdAt,
      variants: populated.variants || [],
    });
    return populated;
  }

  async updateProduct(id, data, file) {
    const existingProduct = await productModel.findById(id);
    if (!existingProduct) throw new Error("Không tìm thấy sản phẩm");

    if (data.categoryId && data.categoryId !== existingProduct.categoryId) {
      const category = await categoryModel.findById(data.categoryId);
      if (!category) throw new Error("Danh mục không tồn tại");
    }

    let imageUrl = existingProduct.imageUrl;

    if (file) {
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

    let tags = data.tags !== undefined ? data.tags : existingProduct.tags;
    if (typeof tags === "string") {
      try { tags = JSON.parse(tags); } catch { tags = tags.split(",").map((t) => t.trim()); }
    }

    const updateData = {
      name: data.name || existingProduct.name,
      description: data.description || existingProduct.description,
      price: data.price ? Number(data.price) : existingProduct.price,
      categoryId: data.categoryId || existingProduct.categoryId,
      gender: data.gender || existingProduct.gender || "Unisex",
      brand: data.brand || existingProduct.brand || "D4C",
      tags,
      isFeatured: data.isFeatured !== undefined
        ? (data.isFeatured === "true" || data.isFeatured === true)
        : (existingProduct.isFeatured || false),
      imageUrl,
      updatedAt: new Date().toISOString(),
    };

    await productModel.update(id, updateData);

    // Update variants
    if (data.variants) {
      let variants = data.variants;
      if (typeof variants === "string") {
        try { variants = JSON.parse(variants); } catch (e) { variants = []; }
      }
      // Remove old variants
      await variantModel.removeByProductId(id);
      // Create new variants
      for (const v of variants) {
        await variantModel.create({
          id: uuidv4(),
          productId: id,
          color: v.color || "",
          size: v.size || "",
          quantity: Number(v.quantity) || 0,
          sku: v.sku || `${id}-${v.color}-${v.size}`.replace(/\s/g, "-")
        });
      }
    }

    const updated = await this.getProductById(id);
    publishProductEvent("UPDATE", {
      id,
      name: updated.name,
      description: updated.description,
      price: updated.price,
      categoryId: updated.categoryId,
      category: updated.category,
      brand: updated.brand,
      gender: updated.gender,
      tags: updated.tags,
      imageUrl: updated.imageUrl,
      isFeatured: updated.isFeatured,
      createdAt: updated.createdAt,
      variants: updated.variants || [],
    });
    return updated;
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

    await variantModel.removeByProductId(id);
    await productModel.remove(id);
    publishProductEvent("DELETE", { id });
    return { success: true, message: "Đã xóa sản phẩm thành công" };
  }

  async deductVariantStock(variantId, quantity) {
    if (!variantId || quantity <= 0) {
      throw new Error("Variant ID và số lượng hợp lệ là bắt buộc");
    }
    return await variantModel.deductStock(variantId, quantity);
  }

  async restoreVariantStock(variantId, quantity) {
    if (!variantId || quantity <= 0) {
      throw new Error("Variant ID và số lượng hợp lệ là bắt buộc");
    }
    return await variantModel.restoreStock(variantId, quantity);
  }
}

export const productService = new ProductService();
