import { categoryModel } from "../models/category.model.js";
import { productModel } from "../models/product.model.js";
import { s3Client } from "../config/aws.config.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { cacheDel, cacheDelPattern, keys } from "./cache.service.js";

dotenv.config();

const BUCKET_NAME = process.env.BUCKET_NAME || "d4c-clothingshop-products-bucket";
const REGION = process.env.AWS_REGION || "ap-southeast-1";

class CategoryService {
  async getAllCategories() {
    return await categoryModel.findAll();
  }

  async getCategoryById(id) {
    return await categoryModel.findById(id);
  }

  async createCategory(data, file) {
    let imageUrl = data.imageUrl || "";

    if (file) {
      const fileKey = `categories/${Date.now()}-${uuidv4()}-${file.originalname.replace(/\s/g, "-")}`;
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      await s3Client.send(new PutObjectCommand(uploadParams));
      imageUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileKey}`;
    }

    const newCategory = {
      id: uuidv4(),
      name: data.name,
      description: data.description || "",
      imageUrl: imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await categoryModel.create(newCategory);
    await cacheDelPattern("product:list:*");
    await cacheDelPattern("product:detail:*");
    await cacheDelPattern("product:related:*");
    await cacheDel(keys.featured());
    await cacheDelPattern("product:new-arrivals:*");
    return newCategory;
  }

  async updateCategory(id, data, file) {
    const existing = await categoryModel.findById(id);
    if (!existing) throw new Error("Category not found");

    let imageUrl = data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl;

    if (file) {
      // Delete old image from S3 if exists
      if (existing.imageUrl && existing.imageUrl.includes(BUCKET_NAME)) {
        try {
          const oldKey = existing.imageUrl.split(".amazonaws.com/")[1];
          if (oldKey) {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: decodeURIComponent(oldKey)
            }));
          }
        } catch (e) {
          console.error("Lỗi khi xóa ảnh S3 cũ của category:", e);
        }
      }
      
      const fileKey = `categories/${Date.now()}-${uuidv4()}-${file.originalname.replace(/\s/g, "-")}`;
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      await s3Client.send(new PutObjectCommand(uploadParams));
      imageUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileKey}`;
    }

    const updateData = {
      name: data.name || existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      imageUrl: imageUrl,
      updatedAt: new Date().toISOString(),
    };

    const result = await categoryModel.update(id, updateData);

    await cacheDelPattern("product:list:*");
    await cacheDelPattern("product:detail:*");
    await cacheDelPattern("product:related:*");
    await cacheDel(keys.featured());
    await cacheDelPattern("product:new-arrivals:*");
    return result;
  }

  async deleteCategory(id) {
    const existing = await categoryModel.findById(id);
    if (!existing) throw new Error("Category not found");

    const products = await productModel.findWithFilters({ categoryId: id });
    if (products && products.length > 0) {
      throw new Error("Cannot delete category because there are products associated with it.");
    }

    // Delete image from S3 if exists
    if (existing.imageUrl && existing.imageUrl.includes(BUCKET_NAME)) {
      try {
        const key = existing.imageUrl.split(".amazonaws.com/")[1];
        if (key) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: decodeURIComponent(key)
          }));
        }
      } catch (e) {
        console.error("Lỗi khi xóa ảnh S3 của category:", e);
      }
    }

    await categoryModel.remove(id);
    await cacheDelPattern("product:list:*");
    await cacheDelPattern("product:detail:*");
    await cacheDelPattern("product:related:*");
    await cacheDel(keys.featured());
    await cacheDelPattern("product:new-arrivals:*");
    return { success: true, message: "Category deleted" };
  }
}

export const categoryService = new CategoryService();
