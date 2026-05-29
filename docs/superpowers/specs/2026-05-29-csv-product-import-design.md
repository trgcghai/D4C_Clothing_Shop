# ZIP Product Import - Design Spec

**Date:** 2026-05-29
**Status:** Draft

## Overview

Add ZIP import functionality to the admin product management page, allowing admins to bulk-create products by uploading a ZIP file containing a CSV manifest and an images folder.

## Architecture

### Approach: Backend Parse ZIP (Recommended)

Frontend uploads ZIP file to backend. Backend extracts, validates CSV + images, then creates products. Two-phase approach: validate ALL rows first, then upload/create (prevents orphan files).

### System Components

```
Frontend (ProductManagement.tsx)
  ├── "Thêm ZIP" button (next to "Thêm sản phẩm")
  ├── ZIP Import Dialog
  │   ├── Drag & drop zone for .zip files
  │   ├── Client-side validation: extension .zip, size <= 50MB
  │   ├── Import button → POST /api/products/import-zip
  │   ├── Loading state during import
  │   └── Result: success toast or detailed error dialog
  └── "Tải file mẫu ZIP" download link

Backend (ProductService)
  ├── Route: POST /api/products/import-zip (multipart, requireAdmin)
  ├── Middleware: upload ZIP file (application/zip, max 50MB)
  ├── Controller: importZipProducts
  └── Service: parseAndImportProducts
        ├── Phase 1: Extract ZIP
        │     ├── Validate structure: must contain 1 CSV file + images/ folder
        │     ├── Parse CSV (csv-parse library)
        │     ├── Validate ALL rows (required fields, format variants/tags)
        │     ├── Validate ALL image references exist in images/ folder
        │     └── If ANY validation fails → throw error, clean up temp files, NO uploads
        ├── Phase 2: Import (only if Phase 1 passes)
        │     ├── Auto-create categories if not exist (name only)
        │     ├── Upload images to S3 (from images/ folder)
        │     ├── Create products + variants + tags
        │     └── Publish events for each product
        └── Cleanup: remove temp extraction directory
```

## ZIP Structure

```
import-file.zip
├── products.csv          # Required: exactly 1 CSV file
└── images/               # Required: folder with product images
    ├── aomiuiu.jpg
    ├── product2.png
    └── product3.webp
```

### CSV Headers (10 columns)

| Column | Required | Type | Description | Example |
|---|---|---|---|---|
| `image` | Yes | File path | Relative path to image in ZIP | `images/aomiuiu.jpg` |
| `name` | Yes | String | Product name (max 200 chars) | `Áo Thun Basic D4C` |
| `price` | Yes | Integer | Price in VND | `250000` |
| `category` | Yes | String | Category name | `Áo thun` |
| `brand` | Yes | String | Brand name | `D4C` |
| `gender` | Yes | String | Gender: Nam/Nữ/Unisex | `Unisex` |
| `description` | No | String | Product description | `Áo thun cotton...` |
| `isFeatured` | No | Boolean | Featured: true/false | `true` |
| `variants` | Yes | Semicolon-delimited | Format: `color|size|qty;color|size|qty;...` | `Đen|S|10;Đen|M|20;Trắng|L|15` |
| `tags` | No | Semicolon-delimited | Format: `tag1;tag2;tag3;...` | `basic;casual;unisex` |

### Example CSV Content

```csv
image,name,price,category,brand,gender,description,isFeatured,variants,tags
images/aomiuiu.jpg,Áo Thun Basic D4C,250000,Áo thun,D4C,Unisex,Áo thun cotton comfortable,false,Đen|S|10;Đen|M|20;Trắng|L|15,basic;casual;unisex
images/jean-slim.jpg,Quần Jean Slim Fit,450000,Quần jean,D4C,Nam,Quần jean slim fit chất liệu denim,true,Đen|30|15;Đen|32|20;Xanh|30|10,jean;slim;denim
```

### Notes on Variant Format

- Variants use `|` (pipe) as delimiter within each variant: `color|size|qty`
- Multiple variants separated by `;` (semicolon): `color1|size1|qty1;color2|size2|qty2`
- This allows color names containing commas, e.g., `Đen, viền trắng|S|10` is valid
- Tags remain semicolon-delimited: `tag1;tag2;tag3`

### Sample ZIP File

A downloadable example ZIP file will be provided in the frontend. It will contain:
- `products.csv` with header row + 2-3 example rows
- `images/` folder with 2-3 placeholder images
- README.txt with instructions (optional)

## API Specification

### Endpoint: `POST /api/products/import-zip`

**Request:**
- Content-Type: `multipart/form-data`
- Field: `zipFile` (File, .zip, application/zip, max 50MB)
- Auth: requireAdmin

**Response 201 (Success):**
```json
{
  "success": true,
  "message": "Import thành công 5 sản phẩm",
  "importedCount": 5
}
```

**Response 400 (Validation Error - All-or-Nothing):**
```json
{
  "success": false,
  "message": "Import thất bại: 3 lỗi tìm thấy",
  "errors": [
    { "row": 2, "field": "price", "message": "Giá phải là số nguyên dương" },
    { "row": 4, "field": "variants", "message": "Format variants sai: thiếu quantity" },
    { "row": 5, "field": "image", "message": "File ảnh 'images/notfound.jpg' không tồn tại trong thư mục images/ của ZIP" }
  ]
}
```

**Response 413 (File Too Large):**
```json
{ "message": "File ZIP vượt quá 50MB" }
```

**Response 415 (Wrong Format):**
```json
{ "message": "Chỉ hỗ trợ file ZIP" }
```

## Validation Rules

### Client-side (Frontend)
- File extension must be `.zip`
- MIME type must be `application/zip` or `application/x-zip-compressed`
- File size must be <= 50MB

### Server-side (Backend)

#### Phase 1: Structure & Content Validation (NO uploads, NO side effects)
1. **ZIP structure validation:**
   - Must contain exactly 1 `.csv` file (any name, at root level)
   - Must contain `images/` folder with at least 1 image file
   - Supported image formats: jpg, jpeg, png, webp, gif
   - **Zip bomb protection:**
     - Compressed file size <= 50MB
     - Extracted total size <= 200MB (compression ratio max 4:1)
     - Total file count <= 500 files (1 CSV + max 499 images)
     - Max individual file size <= 50MB
     - Max directory depth <= 3 levels (root → images/ → files)
     - Reject entries with symlinks or unusual permissions

2. **CSV header validation:**
   - Must contain all required columns: `image`, `name`, `price`, `category`, `brand`, `gender`, `variants`

3. **Row validation (per row, ALL rows validated before Phase 2):**
   - `image`: Non-empty, must be a relative path starting with `images/`, file must exist in ZIP's images/ folder
   - `name`: Non-empty, max 200 characters
   - `price`: Positive integer
   - `category`: Non-empty string
   - `brand`: Non-empty, must be in valid brands list: Nike, Adidas, Zara, D4C, H&M, Uniqlo, Local Brand
   - `gender`: Must be "Nam", "Nữ", or "Unisex"
   - `variants`: At least 1 variant, format `color|size|qty` per variant (pipe-delimited), qty >= 0, color and size non-empty
   - `isFeatured`: If present, must be "true" or "false" (case-insensitive)
   - `tags`: If present, non-empty strings

4. **Cross-row validation:**
   - Collect ALL errors from ALL rows before proceeding
   - If ANY error exists → return all errors, clean up temp files, NO products created, NO images uploaded

#### Phase 2: Import (only if Phase 1 passes completely)
- Auto-create categories that don't exist (name only, imageUrl and description empty)
- Upload images to S3 from ZIP's images/ folder
- Create products + variants + tags
- Publish events for each product
- Clean up temp extraction directory

### Key: All-or-Nothing Guarantee
Phase 1 validates EVERYTHING before Phase 2 begins. This prevents orphan files on S3 and orphan categories in the database. If validation fails at any point, the temp directory is cleaned up and nothing is persisted.

## Category Auto-Creation

If a category name in the CSV does not exist:
- Backend automatically creates a new category with just the name
- `imageUrl` and `description` are left empty/null
- Category is created before the first product that references it
- If category creation fails, the entire import fails (all-or-nothing)

## Frontend UX Flow

1. Admin clicks "Thêm ZIP" button → opens ZIP Import Dialog
2. Dialog shows:
   - Drag & drop zone for ZIP files (also supports file picker)
   - Client-side validation: checks extension `.zip`, file size <= 50MB
   - If invalid → immediate error message, file not sent
   - "Import" button (disabled until valid file is selected)
   - "Tải file mẫu ZIP" download link (always visible below drop zone)
3. Admin clicks "Import" → loading spinner, button disabled
4. Backend responds:
   - **Success:** Toast notification "Import thành công X sản phẩm", dialog closes, product list refreshes
   - **Error:** Error dialog shows detailed list of errors (row number, field, message), dialog stays open so admin can fix ZIP and re-upload
5. On dialog close, reset all state (file, errors, loading)

## Error Display

When validation fails, show errors in a table:

| Dòng | Trường | Lỗi |
|------|--------|-----|
| 2 | price | Giá phải là số nguyên dương |
| 4 | variants | Format variants sai: thiếu quantity |
| 5 | image | Ảnh base64 không hợp lệ |

## File Changes

### Frontend
- **New file:** `frontend/src/components/ZipImportDialog.tsx` - ZIP import dialog component
- **Modified:** `frontend/src/pages/admin/ProductManagement.tsx` - Add "Thêm ZIP" button and import dialog
- **Modified:** `frontend/src/services/productApi.ts` - Add `importProductsFromZip` API function
- **New file:** `frontend/public/sample-product-import.zip` - Sample ZIP file for download

### Backend (ProductService)
- **New file:** `ProductService/src/middlewares/zip-upload.middleware.js` - ZIP file upload middleware
- **New file:** `ProductService/src/services/zip-import.service.js` - ZIP extraction, CSV parsing, validation, and import logic
- **New file:** `ProductService/src/controllers/zip-import.controller.js` - ZIP import controller
- **Modified:** `ProductService/src/routes/product.routes.js` - Add POST /api/products/import-zip route
- **Modified:** `ProductService/package.json` - Add `extract-zip` and `csv-parse` dependencies

### CategoryService (if separate service)
- If category auto-creation needs to call CategoryService, add endpoint or reuse existing create category API
- **Note:** Current architecture has ProductService managing categories via `categoryModel` directly, so no cross-service call needed

## Dependencies

- Backend: `csv-parse` npm package for CSV parsing
- Backend: `extract-zip` npm package for ZIP extraction
- Frontend: No new dependencies (uses existing Dialog, Button, etc. from shadcn/ui)

## Security Considerations

- requireAdmin middleware protects the endpoint
- **Zip bomb protection:** compressed size <= 50MB, extracted total <= 200MB (4:1 ratio), max 500 files, max depth 3 levels, no symlinks
- MIME type validation prevents non-ZIP uploads
- ZIP extraction via `extract-zip` with size/file count limits checked during extraction
- Image file validation: only allow jpg, jpeg, png, webp, gif extensions
- Path traversal prevention: image paths must start with `images/`, no `../` allowed
- S3 upload uses existing secure upload flow
- Two-phase validation ensures no orphan files or partial imports
- Temp directory cleaned up after import (success or failure)

## Testing Strategy

### Backend
- Unit tests for ZIP extraction with `extract-zip` (valid ZIP, malformed ZIP, missing CSV, missing images/)
- Unit tests for zip bomb detection (ratio > 4:1, > 500 files, > 3 depth, symlinks)
- Unit tests for CSV parsing (valid CSV, malformed CSV, missing headers)
- Unit tests for validation rules (each field, edge cases, pipe-delimited variants)
- Unit tests for image reference validation (file exists vs missing in images/)
- Integration test for Phase 1 → Phase 2 flow (happy path)
- Integration test for Phase 1 failure → no uploads, no products created, temp cleanup
- Integration test for orphan file prevention (validate all before any upload)
- Test category auto-creation
- Test image upload to S3 from ZIP images/ folder

### Frontend
- Test file validation (wrong extension, too large)
- Test drag & drop behavior
- Test success flow (mock API response)
- Test error flow (mock validation errors, check error table rendering)
- Test sample ZIP download link
