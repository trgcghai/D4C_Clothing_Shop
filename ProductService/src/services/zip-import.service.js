import extract from "extract-zip";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/aws.config.js";
import { productModel } from "../models/product.model.js";
import { variantModel } from "../models/variant.model.js";
import { categoryModel } from "../models/category.model.js";
import { publishProductEvent } from "./event-publisher.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = process.env.BUCKET_NAME || "d4c-clothingshop-products-bucket";
const REGION = process.env.AWS_REGION || "ap-southeast-1";

const VALID_BRANDS = ["Nike", "Adidas", "Zara", "D4C", "H&M", "Uniqlo", "Local Brand"];
const VALID_GENDERS = ["Nam", "Nữ", "Unisex"];
const VALID_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

const ZIP_BOMB_LIMITS = {
  maxCompressedSize: 50 * 1024 * 1024,
  maxExtractedSize: 200 * 1024 * 1024,
  maxFileCount: 500,
  maxIndividualFileSize: 50 * 1024 * 1024,
  maxDepth: 3,
};

async function extractZip(zipBuffer, tempDir) {
  const zipPath = path.join(tempDir, "upload.zip");
  fs.writeFileSync(zipPath, zipBuffer);

  if (zipBuffer.length > ZIP_BOMB_LIMITS.maxCompressedSize) {
    throw new Error("File ZIP vượt quá 50MB");
  }

  let fileCount = 0;

  await extract(zipPath, {
    dir: tempDir,
    onEntry: (entry) => {
      fileCount++;
      if (fileCount > ZIP_BOMB_LIMITS.maxFileCount) {
        throw new Error(`ZIP chứa quá nhiều file (giới hạn ${ZIP_BOMB_LIMITS.maxFileCount})`);
      }

      if (entry.fileName.endsWith("/")) return;

      const parts = entry.fileName.split("/").filter((p) => p);
      if (parts.length > ZIP_BOMB_LIMITS.maxDepth) {
        throw new Error(`Cấu trúc ZIP quá sâu (giới hạn ${ZIP_BOMB_LIMITS.maxDepth} levels)`);
      }

      if (entry.externalFileAttributes) {
        const unixMode = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (unixMode === 0o120000) {
          throw new Error("ZIP chứa symlink không được hỗ trợ");
        }
      }
    },
  });

  function getDirSize(dir) {
    let size = 0;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        size += getDirSize(fullPath);
      } else {
        const stat = fs.statSync(fullPath);
        size += stat.size;
        if (stat.size > ZIP_BOMB_LIMITS.maxIndividualFileSize) {
          throw new Error(`File '${item.name}' vượt quá giới hạn 50MB`);
        }
      }
    }
    return size;
  }

  const totalExtractedSize = getDirSize(tempDir);
  if (totalExtractedSize > ZIP_BOMB_LIMITS.maxExtractedSize) {
    throw new Error("Dung lượng giải nén vượt quá 200MB (tỉ lệ nén tối đa 4:1)");
  }

  fs.unlinkSync(zipPath);
}

function validateZipStructure(tempDir) {
  const errors = [];
  const items = fs.readdirSync(tempDir, { withFileTypes: true });

  const csvFiles = items.filter(
    (item) => item.isFile() && item.name.toLowerCase().endsWith(".csv")
  );
  if (csvFiles.length === 0) {
    errors.push({ row: 0, field: "structure", message: "ZIP phải chứa ít nhất 1 file CSV" });
  } else if (csvFiles.length > 1) {
    errors.push({ row: 0, field: "structure", message: "ZIP chỉ được chứa đúng 1 file CSV" });
  }

  const imagesDir = path.join(tempDir, "images");
  if (!fs.existsSync(imagesDir) || !fs.statSync(imagesDir).isDirectory()) {
    errors.push({ row: 0, field: "structure", message: "ZIP phải chứa thư mục 'images/'" });
  } else {
    const imageFiles = fs.readdirSync(imagesDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return VALID_IMAGE_EXTS.includes(ext);
    });
    if (imageFiles.length === 0) {
      errors.push({ row: 0, field: "structure", message: "Thư mục 'images/' phải chứa ít nhất 1 file ảnh (jpg, png, webp, gif)" });
    }
  }

  return errors;
}

function parseAndValidateCsv(tempDir, imageFiles) {
  const items = fs.readdirSync(tempDir, { withFileTypes: true });
  const csvFile = items.find((item) => item.isFile() && item.name.toLowerCase().endsWith(".csv"));
  const csvPath = path.join(tempDir, csvFile.name);
  const csvContent = fs.readFileSync(csvPath, "utf-8");

  const errors = [];
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    errors.push({ row: 0, field: "csv", message: "File CSV không có dữ liệu" });
    return { records: [], errors };
  }

  const requiredHeaders = ["image", "name", "price", "category", "brand", "gender", "variants"];
  const headers = Object.keys(records[0]);
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    errors.push({
      row: 0,
      field: "headers",
      message: `Thiếu cột: ${missingHeaders.join(", ")}`,
    });
    return { records: [], errors };
  }

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;

    if (!row.image || !row.image.trim()) {
      errors.push({ row: rowNum, field: "image", message: "Đường dẫn ảnh không được để trống" });
    } else {
      const imgPath = row.image.trim();
      if (!imgPath.startsWith("images/")) {
        errors.push({ row: rowNum, field: "image", message: `Đường dẫn ảnh phải bắt đầu bằng 'images/' (hiện tại: '${imgPath}')` });
      } else if (!imageFiles.has(imgPath)) {
        errors.push({ row: rowNum, field: "image", message: `File ảnh '${imgPath}' không tồn tại trong thư mục images/ của ZIP` });
      }
    }

    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, field: "name", message: "Tên sản phẩm không được để trống" });
    } else if (row.name.trim().length > 200) {
      errors.push({ row: rowNum, field: "name", message: "Tên sản phẩm vượt quá 200 ký tự" });
    }

    if (!row.price) {
      errors.push({ row: rowNum, field: "price", message: "Giá bán không được để trống" });
    } else {
      const price = Number(row.price);
      if (!Number.isInteger(price) || price <= 0) {
        errors.push({ row: rowNum, field: "price", message: "Giá phải là số nguyên dương" });
      }
    }

    if (!row.category || !row.category.trim()) {
      errors.push({ row: rowNum, field: "category", message: "Danh mục không được để trống" });
    }

    if (!row.brand || !row.brand.trim()) {
      errors.push({ row: rowNum, field: "brand", message: "Thương hiệu không được để trống" });
    } else if (!VALID_BRANDS.includes(row.brand.trim())) {
      errors.push({ row: rowNum, field: "brand", message: `Thương hiệu không hợp lệ. Chấp nhận: ${VALID_BRANDS.join(", ")}` });
    }

    if (!row.gender || !row.gender.trim()) {
      errors.push({ row: rowNum, field: "gender", message: "Giới tính không được để trống" });
    } else if (!VALID_GENDERS.includes(row.gender.trim())) {
      errors.push({ row: rowNum, field: "gender", message: `Giới tính phải là Nam, Nữ hoặc Unisex` });
    }

    if (!row.variants || !row.variants.trim()) {
      errors.push({ row: rowNum, field: "variants", message: "Phải có ít nhất 1 biến thể" });
    } else {
      const variantStrs = row.variants.split(";").filter((v) => v.trim());
      if (variantStrs.length === 0) {
        errors.push({ row: rowNum, field: "variants", message: "Phải có ít nhất 1 biến thể" });
      } else {
        for (let j = 0; j < variantStrs.length; j++) {
          const parts = variantStrs[j].split("|");
          if (parts.length !== 3) {
            errors.push({ row: rowNum, field: "variants", message: `Biến thể '${variantStrs[j]}' sai format. Đúng: color|size|qty` });
            break;
          }
          const [color, size, qtyStr] = parts.map((p) => p.trim());
          if (!color) {
            errors.push({ row: rowNum, field: "variants", message: `Biến thể '${variantStrs[j]}' thiếu màu sắc` });
            break;
          }
          if (!size) {
            errors.push({ row: rowNum, field: "variants", message: `Biến thể '${variantStrs[j]}' thiếu kích thước` });
            break;
          }
          const qty = Number(qtyStr);
          if (!Number.isInteger(qty) || qty < 0) {
            errors.push({ row: rowNum, field: "variants", message: `Biến thể '${variantStrs[j]}' số lượng phải là số nguyên >= 0` });
            break;
          }
        }
      }
    }

    if (row.isFeatured && row.isFeatured.trim()) {
      const val = row.isFeatured.trim().toLowerCase();
      if (val !== "true" && val !== "false") {
        errors.push({ row: rowNum, field: "isFeatured", message: "isFeatured phải là 'true' hoặc 'false'" });
      }
    }

    if (row.tags && row.tags.trim()) {
      const tags = row.tags.split(";").map((t) => t.trim()).filter((t) => t);
      if (tags.length === 0) {
        errors.push({ row: rowNum, field: "tags", message: "Tags không hợp lệ" });
      }
    }
  }

  return { records, errors };
}

async function getOrCreateCategory(categoryName, categoryCache, newCategoryIds) {
  const lowerName = categoryName.toLowerCase();
  if (categoryCache.has(lowerName)) {
    return categoryCache.get(lowerName);
  }

  const allCategories = await categoryModel.findAll();
  const existing = allCategories.find((c) => c.name.toLowerCase() === lowerName);
  if (existing) {
    const result = { id: existing.id, name: existing.name };
    categoryCache.set(lowerName, result);
    return result;
  }

  const newCategory = {
    id: uuidv4(),
    name: categoryName,
    description: "",
    imageUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await categoryModel.create(newCategory);
  if (newCategoryIds) {
    newCategoryIds.push(newCategory.id);
  }
  const result = { id: newCategory.id, name: newCategory.name };
  categoryCache.set(lowerName, result);
  return result;
}

async function uploadImageToS3(filePath, originalName) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileKey = `products/${Date.now()}-${uuidv4()}-${originalName.replace(/\s/g, "-")}`;
  const ext = path.extname(originalName).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: mimeTypes[ext] || "application/octet-stream",
    })
  );

  return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileKey}`;
}

export class ZipImportService {
  async importZip(zipBuffer) {
    const tempDir = path.join(__dirname, "../../temp", `zip-import-${Date.now()}-${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      await extractZip(zipBuffer, tempDir);

      const structureErrors = validateZipStructure(tempDir);
      if (structureErrors.length > 0) {
        return { success: false, errors: structureErrors, importedCount: 0 };
      }

      const imagesDir = path.join(tempDir, "images");
      const imageFiles = new Set(fs.readdirSync(imagesDir).map((f) => `images/${f}`));

      const { records, errors: csvErrors } = parseAndValidateCsv(tempDir, imageFiles);
      if (csvErrors.length > 0) {
        return { success: false, errors: csvErrors, importedCount: 0 };
      }

      const categoryCache = new Map();
      let importedCount = 0;

      const createdResources = {
        productIds: [],
        variantIds: [],
        s3Keys: [],
        categoryIds: [],
      };

      for (let i = 0; i < records.length; i++) {
        const row = records[i];

        const categoryResult = await getOrCreateCategory(row.category.trim(), categoryCache, createdResources.categoryIds);

        const imageRelPath = row.image.trim();
        const imageFullPath = path.join(tempDir, imageRelPath);
        const imageUrl = await uploadImageToS3(imageFullPath, path.basename(imageRelPath));
        const s3Key = imageUrl.split(`.amazonaws.com/`)[1];
        createdResources.s3Keys.push(s3Key);

        const variants = row.variants.split(";").filter((v) => v.trim()).map((v) => {
          const [color, size, qtyStr] = v.split("|").map((p) => p.trim());
          return { color, size, quantity: Number(qtyStr) };
        });

        const tags = row.tags
          ? row.tags.split(";").map((t) => t.trim()).filter((t) => t)
          : [];

        const newProduct = {
          id: uuidv4(),
          name: row.name.trim(),
          description: row.description?.trim() || "",
          price: Number(row.price),
          categoryId: categoryResult.id,
          gender: row.gender.trim() || "Unisex",
          brand: row.brand.trim() || "D4C",
          tags,
          isFeatured: row.isFeatured?.trim().toLowerCase() === "true" || false,
          imageUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await productModel.create(newProduct);
        createdResources.productIds.push(newProduct.id);

        for (const v of variants) {
          const variantId = uuidv4();
          await variantModel.create({
            id: variantId,
            productId: newProduct.id,
            color: v.color,
            size: v.size,
            quantity: v.quantity,
            sku: `${newProduct.id}-${v.color}-${v.size}`.replace(/\s/g, "-"),
          });
          createdResources.variantIds.push(variantId);
        }

        publishProductEvent("CREATE", {
          id: newProduct.id,
          name: newProduct.name,
          description: newProduct.description,
          price: newProduct.price,
          categoryId: newProduct.categoryId,
          category: categoryResult.name,
          brand: newProduct.brand,
          gender: newProduct.gender,
          tags: newProduct.tags,
          imageUrl: newProduct.imageUrl,
          isFeatured: newProduct.isFeatured,
          createdAt: newProduct.createdAt,
          variants,
        });

        importedCount++;
      }

      return { success: true, importedCount, errors: [] };
    } catch (error) {
      // Rollback: delete S3 images
      for (const key of createdResources.s3Keys) {
        try {
          await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        } catch (e) {
          console.error("Rollback: failed to delete S3 key:", key, e);
        }
      }

      // Rollback: delete variants
      for (const id of createdResources.variantIds) {
        try { await variantModel.remove(id); } catch (e) { console.error("Rollback: failed to delete variant:", id, e); }
      }

      // Rollback: delete products
      for (const id of createdResources.productIds) {
        try { await productModel.remove(id); } catch (e) { console.error("Rollback: failed to delete product:", id, e); }
      }

      // Rollback: delete newly created categories
      for (const id of createdResources.categoryIds) {
        try { await categoryModel.remove(id); } catch (e) { console.error("Rollback: failed to delete category:", id, e); }
      }

      return {
        success: false,
        errors: [{ row: 0, field: "system", message: error.message }],
        importedCount: 0,
      };
    } finally {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }
}

export const zipImportService = new ZipImportService();
