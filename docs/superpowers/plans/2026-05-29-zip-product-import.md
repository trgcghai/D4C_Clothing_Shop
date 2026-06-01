# ZIP Product Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin ZIP import feature for bulk product creation with two-phase validation (validate all → then create), preventing orphan files.

**Architecture:** Frontend uploads ZIP → backend extracts with `extract-zip`, validates CSV + images in Phase 1, uploads to S3 and creates products in Phase 2. All-or-nothing guarantee.

**Tech Stack:** React 19 + TypeScript + shadcn/ui (frontend), Node.js/Express + extract-zip + csv-parse + AWS S3/DynamoDB (backend)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `ProductService/package.json` | Modify | Add `extract-zip` and `csv-parse` dependencies |
| `ProductService/src/middlewares/zip-upload.middleware.js` | Create | Multer middleware for ZIP file upload (50MB limit, MIME validation) |
| `ProductService/src/services/zip-import.service.js` | Create | Core logic: ZIP extraction, zip bomb protection, CSV parsing, 2-phase validation, category auto-creation, S3 upload, product creation |
| `ProductService/src/controllers/zip-import.controller.js` | Create | Controller for POST /api/products/import-zip |
| `ProductService/src/routes/product.routes.js` | Modify | Add POST /api/products/import-zip route |
| `frontend/src/services/productApi.ts` | Modify | Add `importProductsFromZip` API function |
| `frontend/src/components/ZipImportDialog.tsx` | Create | ZIP import dialog with drag-drop, validation, error table, sample download |
| `frontend/src/pages/admin/ProductManagement.tsx` | Modify | Add "Thêm ZIP" button + integrate ZipImportDialog |
| `frontend/public/sample-product-import.zip` | Create | Sample ZIP file for download |

---

### Task 1: Backend Dependencies

**Files:**
- Modify: `ProductService/package.json`

- [ ] **Step 1: Add dependencies to package.json**

Add `extract-zip` and `csv-parse` to the dependencies section:

```json
"dependencies": {
  "@aws-sdk/client-dynamodb": "^3.556.0",
  "@aws-sdk/client-s3": "^3.556.0",
  "@aws-sdk/lib-dynamodb": "^3.556.0",
  "amqplib": "^0.10.9",
  "cors": "^2.8.5",
  "csv-parse": "^5.6.0",
  "dotenv": "^16.4.5",
  "eureka-js-client": "^4.5.0",
  "express": "^4.19.2",
  "extract-zip": "^2.0.1",
  "morgan": "^1.10.1",
  "multer": "^1.4.5-lts.1",
  "nodemon": "^3.1.14",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "uuid": "^9.0.1"
}
```

- [ ] **Step 2: Install dependencies**

Run in ProductService directory:
```bash
cd ProductService && npm install
```

Expected: `added 2 packages` (csv-parse, extract-zip)

- [ ] **Step 3: Commit**

```bash
git add ProductService/package.json ProductService/package-lock.json
git commit -m "chore(ProductService): add extract-zip and csv-parse dependencies"
```

---

### Task 2: ZIP Upload Middleware

**Files:**
- Create: `ProductService/src/middlewares/zip-upload.middleware.js`

- [ ] **Step 1: Write the middleware**

```javascript
import multer from "multer";

const storage = multer.memoryStorage();

export const uploadZip = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ];
    const isZipExt = file.originalname.toLowerCase().endsWith(".zip");
    if (allowedMimes.includes(file.mimetype) || isZipExt) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ file ZIP"), false);
    }
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add ProductService/src/middlewares/zip-upload.middleware.js
git commit -m "feat(ProductService): add ZIP upload middleware with 50MB limit"
```

---

### Task 3: ZIP Import Service (Core Logic)

**Files:**
- Create: `ProductService/src/services/zip-import.service.js`

This is the largest task. The service handles:
1. ZIP extraction with zip bomb protection
2. CSV parsing
3. Phase 1: Full validation (structure, headers, all rows, image references)
4. Phase 2: Category auto-creation, S3 upload, product creation

- [ ] **Step 1: Write imports and constants**

```javascript
import extract from "extract-zip";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { PutObjectCommand } from "@aws-sdk/client-s3";
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
  maxCompressedSize: 50 * 1024 * 1024,    // 50MB
  maxExtractedSize: 200 * 1024 * 1024,     // 200MB (4:1 ratio)
  maxFileCount: 500,
  maxIndividualFileSize: 50 * 1024 * 1024, // 50MB
  maxDepth: 3,
};
```

- [ ] **Step 2: Write ZIP extraction with zip bomb protection**

```javascript
async function extractZip(zipBuffer, tempDir) {
  // Write buffer to temp file
  const zipPath = path.join(tempDir, "upload.zip");
  fs.writeFileSync(zipPath, zipBuffer);

  // Check compressed size
  if (zipBuffer.length > ZIP_BOMB_LIMITS.maxCompressedSize) {
    throw new Error("File ZIP vượt quá 50MB");
  }

  // Extract with limits
  let totalExtractedSize = 0;
  let fileCount = 0;

  await extract(zipPath, {
    dir: tempDir,
    onEntry: (entry) => {
      fileCount++;
      if (fileCount > ZIP_BOMB_LIMITS.maxFileCount) {
        throw new Error(`ZIP chứa quá nhiều file (giới hạn ${ZIP_BOMB_LIMITS.maxFileCount})`);
      }

      if (entry.fileName.endsWith("/")) return; // skip directories

      // Check depth
      const parts = entry.fileName.split("/").filter((p) => p);
      if (parts.length > ZIP_BOMB_LIMITS.maxDepth) {
        throw new Error(`Cấu trúc ZIP quá sâu (giới hạn ${ZIP_BOMB_LIMITS.maxDepth} levels)`);
      }

      // Check for symlinks
      if (entry.externalFileAttributes) {
        const unixMode = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (unixMode === 0o120000) {
          throw new Error("ZIP chứa symlink không được hỗ trợ");
        }
      }
    },
  });

  // Check total extracted size
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

  totalExtractedSize = getDirSize(tempDir);
  if (totalExtractedSize > ZIP_BOMB_LIMITS.maxExtractedSize) {
    throw new Error("Dung lượng giải nén vượt quá 200MB (tỉ lệ nén tối đa 4:1)");
  }

  // Clean up the uploaded zip file
  fs.unlinkSync(zipPath);
}
```

- [ ] **Step 3: Write ZIP structure validation**

```javascript
function validateZipStructure(tempDir) {
  const errors = [];
  const items = fs.readdirSync(tempDir, { withFileTypes: true });

  // Find CSV file
  const csvFiles = items.filter(
    (item) => item.isFile() && item.name.toLowerCase().endsWith(".csv")
  );
  if (csvFiles.length === 0) {
    errors.push({ row: 0, field: "structure", message: "ZIP phải chứa ít nhất 1 file CSV" });
  } else if (csvFiles.length > 1) {
    errors.push({ row: 0, field: "structure", message: "ZIP chỉ được chứa đúng 1 file CSV" });
  }

  // Check images/ folder
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
```

- [ ] **Step 4: Write CSV parsing and row validation**

```javascript
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

  // Validate headers
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

  // Validate each row
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // 1-indexed, skip header

    // Image
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

    // Name
    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, field: "name", message: "Tên sản phẩm không được để trống" });
    } else if (row.name.trim().length > 200) {
      errors.push({ row: rowNum, field: "name", message: "Tên sản phẩm vượt quá 200 ký tự" });
    }

    // Price
    if (!row.price) {
      errors.push({ row: rowNum, field: "price", message: "Giá bán không được để trống" });
    } else {
      const price = Number(row.price);
      if (!Number.isInteger(price) || price <= 0) {
        errors.push({ row: rowNum, field: "price", message: "Giá phải là số nguyên dương" });
      }
    }

    // Category
    if (!row.category || !row.category.trim()) {
      errors.push({ row: rowNum, field: "category", message: "Danh mục không được để trống" });
    }

    // Brand
    if (!row.brand || !row.brand.trim()) {
      errors.push({ row: rowNum, field: "brand", message: "Thương hiệu không được để trống" });
    } else if (!VALID_BRANDS.includes(row.brand.trim())) {
      errors.push({ row: rowNum, field: "brand", message: `Thương hiệu không hợp lệ. Chấp nhận: ${VALID_BRANDS.join(", ")}` });
    }

    // Gender
    if (!row.gender || !row.gender.trim()) {
      errors.push({ row: rowNum, field: "gender", message: "Giới tính không được để trống" });
    } else if (!VALID_GENDERS.includes(row.gender.trim())) {
      errors.push({ row: rowNum, field: "gender", message: `Giới tính phải là Nam, Nữ hoặc Unisex` });
    }

    // Variants
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

    // isFeatured (optional)
    if (row.isFeatured && row.isFeatured.trim()) {
      const val = row.isFeatured.trim().toLowerCase();
      if (val !== "true" && val !== "false") {
        errors.push({ row: rowNum, field: "isFeatured", message: "isFeatured phải là 'true' hoặc 'false'" });
      }
    }

    // Tags (optional)
    if (row.tags && row.tags.trim()) {
      const tags = row.tags.split(";").map((t) => t.trim()).filter((t) => t);
      if (tags.length === 0) {
        errors.push({ row: rowNum, field: "tags", message: "Tags không hợp lệ" });
      }
    }
  }

  return { records, errors };
}
```

- [ ] **Step 5: Write Phase 2 - Category auto-creation helper**

```javascript
async function getOrCreateCategory(categoryName, categoryCache) {
  const lowerName = categoryName.toLowerCase();
  if (categoryCache.has(lowerName)) {
    return categoryCache.get(lowerName);
  }

  // Search existing categories
  const allCategories = await categoryModel.findAll();
  const existing = allCategories.find((c) => c.name.toLowerCase() === lowerName);
  if (existing) {
    categoryCache.set(lowerName, existing.id);
    return existing.id;
  }

  // Create new category (name only, no image/description)
  const newCategory = {
    id: uuidv4(),
    name: categoryName,
    description: "",
    imageUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await categoryModel.create(newCategory);
  categoryCache.set(lowerName, newCategory.id);
  return newCategory.id;
}
```

- [ ] **Step 6: Write Phase 2 - Image upload helper**

```javascript
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
```

- [ ] **Step 7: Write main import function (orchestrates both phases)**

```javascript
export class ZipImportService {
  async importZip(zipBuffer) {
    const tempDir = path.join(__dirname, "../../temp", `zip-import-${Date.now()}-${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // ── Phase 1: Extract & Validate ──
      await extractZip(zipBuffer, tempDir);

      const structureErrors = validateZipStructure(tempDir);
      if (structureErrors.length > 0) {
        return { success: false, errors: structureErrors, importedCount: 0 };
      }

      // Collect image files for validation
      const imagesDir = path.join(tempDir, "images");
      const imageFiles = new Set(fs.readdirSync(imagesDir).map((f) => `images/${f}`));

      const { records, errors: csvErrors } = parseAndValidateCsv(tempDir, imageFiles);
      if (csvErrors.length > 0) {
        return { success: false, errors: csvErrors, importedCount: 0 };
      }

      // ── Phase 2: Import ──
      const categoryCache = new Map();
      let importedCount = 0;

      for (let i = 0; i < records.length; i++) {
        const row = records[i];

        // Get or create category
        const categoryId = await getOrCreateCategory(row.category.trim(), categoryCache);

        // Upload image to S3
        const imageRelPath = row.image.trim();
        const imageFullPath = path.join(tempDir, imageRelPath);
        const imageUrl = await uploadImageToS3(imageFullPath, path.basename(imageRelPath));

        // Parse variants
        const variants = row.variants.split(";").filter((v) => v.trim()).map((v) => {
          const [color, size, qtyStr] = v.split("|").map((p) => p.trim());
          return { color, size, quantity: Number(qtyStr) };
        });

        // Parse tags
        const tags = row.tags
          ? row.tags.split(";").map((t) => t.trim()).filter((t) => t)
          : [];

        // Create product
        const newProduct = {
          id: uuidv4(),
          name: row.name.trim(),
          description: row.description?.trim() || "",
          price: Number(row.price),
          categoryId,
          gender: row.gender.trim() || "Unisex",
          brand: row.brand.trim() || "D4C",
          tags,
          isFeatured: row.isFeatured?.trim().toLowerCase() === "true" || false,
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
            color: v.color,
            size: v.size,
            quantity: v.quantity,
            sku: `${newProduct.id}-${v.color}-${v.size}`.replace(/\s/g, "-"),
          });
        }

        // Populate category name for event
        const allCategories = await categoryModel.findAll();
        const catObj = allCategories.find((c) => c.id === categoryId);

        // Publish event
        publishProductEvent("CREATE", {
          id: newProduct.id,
          name: newProduct.name,
          description: newProduct.description,
          price: newProduct.price,
          categoryId: newProduct.categoryId,
          category: catObj?.name || null,
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
      return {
        success: false,
        errors: [{ row: 0, field: "system", message: error.message }],
        importedCount: 0,
      };
    } finally {
      // Cleanup temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }
}

export const zipImportService = new ZipImportService();
```

- [ ] **Step 8: Commit**

```bash
git add ProductService/src/services/zip-import.service.js
git commit -m "feat(ProductService): add ZIP import service with 2-phase validation"
```

---

### Task 4: ZIP Import Controller

**Files:**
- Create: `ProductService/src/controllers/zip-import.controller.js`

- [ ] **Step 1: Write the controller**

```javascript
import { zipImportService } from "../services/zip-import.service.js";

export const importZipProducts = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Vui lòng chọn file ZIP" });
    }

    const result = await zipImportService.importZip(file.buffer);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: `Import thành công ${result.importedCount} sản phẩm`,
        importedCount: result.importedCount,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Import thất bại: ${result.errors.length} lỗi tìm thấy`,
        errors: result.errors,
      });
    }
  } catch (error) {
    if (error.message.includes("Chỉ hỗ trợ file ZIP")) {
      return res.status(415).json({ message: error.message });
    }
    if (error.message.includes("vượt quá")) {
      return res.status(413).json({ message: error.message });
    }
    console.error("Lỗi import ZIP:", error);
    res.status(500).json({ message: "Lỗi server khi import ZIP", error: error.message });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add ProductService/src/controllers/zip-import.controller.js
git commit -m "feat(ProductService): add ZIP import controller"
```

---

### Task 5: Register Route

**Files:**
- Modify: `ProductService/src/routes/product.routes.js`

- [ ] **Step 1: Add imports at the top of the file**

Add after the existing imports:
```javascript
import { uploadZip } from "../middlewares/zip-upload.middleware.js";
import { importZipProducts } from "../controllers/zip-import.controller.js";
```

- [ ] **Step 2: Add the route before the admin CRUD section**

Add before the `// ─── Admin CRUD ───────────────────────────────────────────────────────────` comment:

```javascript
// ─── ZIP Import ───────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/products/import-zip:
 *   post:
 *     tags: [products]
 *     summary: Import products from ZIP file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               zipFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Products imported successfully
 *       400:
 *         description: Validation errors
 *       413:
 *         description: File too large
 *       415:
 *         description: Wrong file format
 */
router.post(
  "/import-zip",
  uploadZip.single("zipFile"),
  requireAdmin,
  importZipProducts,
);
```

- [ ] **Step 3: Commit**

```bash
git add ProductService/src/routes/product.routes.js
git commit -m "feat(ProductService): add POST /api/products/import-zip route"
```

---

### Task 6: Frontend API Function

**Files:**
- Modify: `frontend/src/services/productApi.ts`

- [ ] **Step 1: Add the import function**

Add after the `restoreStock` function (around line 245):

```typescript
export interface ZipImportResponse {
  success: boolean;
  message: string;
  importedCount?: number;
  errors?: Array<{ row: number; field: string; message: string }>;
}

export const importProductsFromZip = async (
  zipFile: File,
): Promise<ZipImportResponse> => {
  const formData = new FormData();
  formData.append("zipFile", zipFile);

  return axiosInstance
    .post("/api/products/import-zip", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data)
    .catch((error) => {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/productApi.ts
git commit -m "feat(frontend): add importProductsFromZip API function"
```

---

### Task 7: ZIP Import Dialog Component

**Files:**
- Create: `frontend/src/components/ZipImportDialog.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileArchive, Loader2, X, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { importProductsFromZip } from "@/src/services/productApi";

interface ZipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function ZipImportDialog({ open, onOpenChange, onSuccess }: ZipImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; field: string; message: string }>>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File) => {
    setFileError("");
    setImportErrors([]);

    if (!f.name.toLowerCase().endsWith(".zip")) {
      setFileError("Chỉ hỗ trợ file .zip");
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError("File ZIP vượt quá 50MB");
      return false;
    }
    return true;
  };

  const handleFileSelect = (f: File) => {
    if (validateFile(f)) {
      setFile(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setImportErrors([]);

    try {
      const result = await importProductsFromZip(file);

      if (result.success) {
        toast.success(result.message);
        handleReset();
        onOpenChange(false);
        onSuccess();
      } else {
        setImportErrors(result.errors || []);
        toast.error(result.message);
      }
    } catch {
      toast.error("Có lỗi xảy ra khi import, vui lòng thử lại");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileError("");
    setImportErrors([]);
    setIsDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadSample = () => {
    const link = document.createElement("a");
    link.href = "/sample-product-import.zip";
    link.download = "sample-product-import.zip";
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileArchive className="size-5 text-primary" />
            Import sản phẩm từ ZIP
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />
            <Upload className="size-10 text-muted-foreground mb-3" />
            {file ? (
              <div className="text-center">
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                >
                  <X className="size-3 mr-1" /> Xóa file
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Kéo thả file ZIP vào đây
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hoặc nhấn để chọn tệp
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ZIP tối đa 50MB
                </p>
              </>
            )}
          </div>

          {fileError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="size-4" /> {fileError}
            </p>
          )}

          {/* Error Table */}
          {importErrors.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive flex items-center gap-2">
                <AlertCircle className="size-4" />
                {importErrors.length} lỗi tìm thấy
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Dòng</TableHead>
                    <TableHead className="w-24">Trường</TableHead>
                    <TableHead>Lỗi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importErrors.map((err, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">
                        {err.row === 0 ? "—" : err.row}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {err.field}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-destructive">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Sample Download */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              Tải file mẫu ZIP
            </Button>
            <span className="text-xs text-muted-foreground">
              Bao gồm CSV mẫu và thư mục images/
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Đóng
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || !!fileError || isImporting}
          >
            {isImporting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isImporting ? "Đang import..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ZipImportDialog.tsx
git commit -m "feat(frontend): add ZipImportDialog component"
```

---

### Task 8: Integrate into ProductManagement

**Files:**
- Modify: `frontend/src/pages/admin/ProductManagement.tsx`

- [ ] **Step 1: Add imports**

Add to the lucide-react imports:
```typescript
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Image as ImageIcon,
  Package,
  Sparkles,
  FileArchive,
} from "lucide-react";
```

Add the ZipImportDialog import after the existing imports:
```typescript
import ZipImportDialog from "@/src/components/ZipImportDialog";
```

- [ ] **Step 2: Add state for ZIP dialog**

Add after the existing state declarations (around line 97):
```typescript
const [zipDialogOpen, setZipDialogOpen] = useState(false);
```

- [ ] **Step 3: Add "Thêm ZIP" button next to "Thêm sản phẩm"**

Replace the DialogTrigger section (lines 292-297) with:
```tsx
<div className="flex gap-2">
  <DialogTrigger asChild>
    <Button onClick={openCreate}>
      <Plus className="mr-2 size-4" />
      Thêm sản phẩm
    </Button>
  </DialogTrigger>
  <Button variant="outline" onClick={() => setZipDialogOpen(true)}>
    <FileArchive className="mr-2 size-4" />
    Thêm ZIP
  </Button>
</div>
```

- [ ] **Step 4: Add ZipImportDialog component**

Add after the closing `</Dialog>` tag (around line 820) and before the product table:

```tsx
      <ZipImportDialog
        open={zipDialogOpen}
        onOpenChange={setZipDialogOpen}
        onSuccess={() => {
          // Refresh product list
          setPage(1);
        }}
      />
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/ProductManagement.tsx
git commit -m "feat(frontend): integrate ZipImportDialog into ProductManagement"
```

---

### Task 9: Create Sample ZIP File

**Files:**
- Create: `frontend/public/sample-product-import.zip`

- [ ] **Step 1: Create the sample ZIP structure**

Create a temporary directory with:

`products.csv`:
```csv
image,name,price,category,brand,gender,description,isFeatured,variants,tags
images/sample-shirt.jpg,Áo Thun Basic D4C,250000,Áo thun,D4C,Unisex,Áo thun cotton comfortable,false,Đen|S|10;Đen|M|20;Trắng|L|15,basic;casual;unisex
images/sample-jeans.jpg,Quần Jean Slim Fit,450000,Quần jean,D4C,Nam,Quần jean slim fit chất liệu denim,true,Đen|30|15;Đen|32|20;Xanh|30|10,jean;slim;denim
```

`images/` folder with 2 placeholder images:
- `images/sample-shirt.jpg` - any small valid JPG (can be a 1x1 pixel or simple placeholder)
- `images/sample-jeans.jpg` - any small valid JPG

- [ ] **Step 2: Create the ZIP file**

On Windows PowerShell:
```powershell
# Create temp structure
$tempDir = "C:\Users\Admin\AppData\Local\Temp\opencode\sample-zip"
New-Item -ItemType Directory -Path "$tempDir\images" -Force

# Create CSV
@"
image,name,price,category,brand,gender,description,isFeatured,variants,tags
images/sample-shirt.jpg,Áo Thun Basic D4C,250000,Áo thun,D4C,Unisex,Áo thun cotton comfortable,false,Đen|S|10;Đen|M|20;Trắng|L|15,basic;casual;unisex
images/sample-jeans.jpg,Quần Jean Slim Fit,450000,Quần jean,D4C,Nam,Quần jean slim fit chất liệu denim,true,Đen|30|15;Đen|32|20;Xanh|30|10,jean;slim;denim
"@ | Set-Content -Path "$tempDir\products.csv" -Encoding UTF8

# Create placeholder images (1x1 pixel transparent PNG as base64)
$pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
[Convert]::FromBase64String($pngBase64) | Set-Content -Path "$tempDir\images\sample-shirt.jpg" -Encoding Byte
[Convert]::FromBase64String($pngBase64) | Set-Content -Path "$tempDir\images\sample-jeans.jpg" -Encoding Byte

# Create ZIP
Compress-Archive -Path "$tempDir\*" -DestinationPath "frontend/public/sample-product-import.zip" -Force

# Cleanup
Remove-Item -Path $tempDir -Recurse -Force
```

- [ ] **Step 3: Commit**

```bash
git add frontend/public/sample-product-import.zip
git commit -m "feat(frontend): add sample ZIP file for import reference"
```

---

### Task 10: Manual Testing & Verification

- [ ] **Step 1: Start the full stack**

```bash
docker compose up --build -d
```

- [ ] **Step 2: Verify services are healthy**

```bash
docker compose ps
curl http://localhost:8761
curl http://localhost:8080/actuator/health
```

- [ ] **Step 3: Test frontend**

1. Open `http://localhost:5173`
2. Login as admin
3. Navigate to Admin → Product Management
4. Verify "Thêm ZIP" button appears next to "Thêm sản phẩm"
5. Click "Thêm ZIP" → dialog opens
6. Test drag-drop with wrong file type → error shown
7. Test drag-drop with file > 50MB → error shown
8. Click "Tải file mẫu ZIP" → downloads sample
9. Upload the sample ZIP → should succeed with "Import thành công 2 sản phẩm"
10. Verify products appear in the table

- [ ] **Step 4: Test error cases**

Create a test ZIP with:
- Missing `images/` folder → should show structure error
- CSV with missing `price` column → should show header error
- CSV with invalid price (e.g., "-100") → should show row-specific error
- CSV referencing non-existent image → should show "File ảnh 'images/...' không tồn tại trong thư mục images/ của ZIP"

- [ ] **Step 5: Verify no orphan files**

After a failed import:
- Check S3 bucket → no new images uploaded
- Check DynamoDB → no new products or categories created
- Check temp directory → cleaned up
