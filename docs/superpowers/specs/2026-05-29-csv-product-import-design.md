# CSV Product Import - Design Spec

**Date:** 2026-05-29
**Status:** Draft

## Overview

Add CSV import functionality to the admin product management page, allowing admins to bulk-create products by uploading a properly formatted CSV file.

## Architecture

### Approach: Backend Parse (Recommended)

Frontend uploads raw CSV file to backend. Backend parses, validates, and creates products. All-or-nothing transaction semantics.

### System Components

```
Frontend (ProductManagement.tsx)
  ├── "Thêm CSV" button (next to "Thêm sản phẩm")
  ├── CSV Import Dialog
  │   ├── Drag & drop zone for .csv files
  │   ├── Client-side validation: extension, MIME type, size <= 10MB
  │   ├── Import button → POST /api/products/import-csv
  │   ├── Loading state during import
  │   └── Result: success toast or detailed error dialog
  └── "Tải file mẫu CSV" download link

Backend (ProductService)
  ├── Route: POST /api/products/import-csv (multipart, requireAdmin)
  ├── Middleware: upload CSV file (text/csv, max 10MB)
  ├── Controller: importCsvProducts
  └── Service: parseAndImportProducts
        ├── Parse CSV (csv-parse library)
        ├── Validate all rows (required fields, format variants/tags)
        ├── If ANY row fails → throw, rollback all (all-or-nothing)
        ├── Auto-create category if not exists (name only, no image/description)
        ├── Decode base64 image → upload to S3 → get imageUrl
        ├── Create product + variants + tags (reuse createProduct logic)
        └── Publish events for each product
```

## CSV Format

### Headers (10 columns)

| Column | Required | Type | Description | Example |
|---|---|---|---|---|
| `image` | Yes | Base64 data URI | Product image | `data:image/png;base64,iVBOR...` |
| `name` | Yes | String | Product name (max 200 chars) | `Áo Thun Basic D4C` |
| `price` | Yes | Integer | Price in VND | `250000` |
| `category` | Yes | String | Category name | `Áo thun` |
| `brand` | Yes | String | Brand name | `D4C` |
| `gender` | Yes | String | Gender: Nam/Nữ/Unisex | `Unisex` |
| `description` | No | String | Product description | `Áo thun cotton...` |
| `isFeatured` | No | Boolean | Featured: true/false | `true` |
| `variants` | Yes | Semicolon-delimited | Format: `color,size,qty;color,size,qty;...` | `Đen,S,10;Đen,M,20;Trắng,L,15` |
| `tags` | No | Semicolon-delimited | Format: `tag1;tag2;tag3;...` | `basic;casual;unisex` |

### Example CSV Content

**Important:** Fields containing commas (variants, base64 images, descriptions) MUST be enclosed in double quotes per RFC 4180 CSV standard. The `csv-parse` library handles this automatically.

```csv
image,name,price,category,brand,gender,description,isFeatured,variants,tags
"data:image/png;base64,iVBOR...",Áo Thun Basic D4C,250000,Áo thun,D4C,Unisex,Áo thun cotton comfortable,false,"Đen,S,10;Đen,M,20;Trắng,L,15",basic;casual;unisex
"data:image/jpeg;base64,/9j/4...",Quần Jean Slim Fit,450000,Quần jean,D4C,Nam,Quần jean slim fit chất liệu denim,true,"Đen,30,15;Đen,32,20;Xanh,30,10",jean;slim;denim
```

### Sample CSV File

A downloadable example CSV file will be provided in the frontend. It will contain:
- Header row with all column names
- 2-3 example rows with placeholder base64 images (short valid data URIs)
- Comments/instructions as a README section above or in a separate tooltip

## API Specification

### Endpoint: `POST /api/products/import-csv`

**Request:**
- Content-Type: `multipart/form-data`
- Field: `csvFile` (File, .csv, text/csv, max 10MB)
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
    { "row": 5, "field": "image", "message": "Ảnh base64 không hợp lệ" }
  ]
}
```

**Response 413 (File Too Large):**
```json
{ "message": "File CSV vượt quá 10MB" }
```

**Response 415 (Wrong Format):**
```json
{ "message": "Chỉ hỗ trợ file CSV" }
```

## Validation Rules

### Client-side (Frontend)
- File extension must be `.csv`
- MIME type must be `text/csv` or `application/vnd.ms-excel`
- File size must be <= 10MB

### Server-side (Backend)
- **Header validation:** CSV must contain all required columns: `image`, `name`, `price`, `category`, `brand`, `gender`, `variants`
- **Row validation (per row):**
  - `image`: Must be a valid data URI (`data:image/...;base64,...`), must decode successfully
  - `name`: Non-empty, max 200 characters
  - `price`: Positive integer
  - `category`: Non-empty string
  - `brand`: Non-empty, must be in valid brands list: Nike, Adidas, Zara, D4C, H&M, Uniqlo, Local Brand
  - `gender`: Must be "Nam", "Nữ", or "Unisex"
  - `variants`: At least 1 variant, format `color,size,qty` per variant, qty >= 0, color and size non-empty
  - `isFeatured`: If present, must be "true" or "false" (case-insensitive)
  - `tags`: If present, non-empty strings
- **All-or-nothing:** If ANY row fails validation, NO products are created. All errors are collected and returned.

## Category Auto-Creation

If a category name in the CSV does not exist:
- Backend automatically creates a new category with just the name
- `imageUrl` and `description` are left empty/null
- Category is created before the first product that references it
- If category creation fails, the entire import fails (all-or-nothing)

## Frontend UX Flow

1. Admin clicks "Thêm CSV" button → opens CSV Import Dialog
2. Dialog shows:
   - Drag & drop zone for CSV files (also supports file picker)
   - Client-side validation: checks extension, MIME type, file size
   - If invalid → immediate error message, file not sent
   - "Import" button (disabled until valid file is selected)
   - "Tải file mẫu CSV" download link (always visible below drop zone)
3. Admin clicks "Import" → loading spinner, button disabled
4. Backend responds:
   - **Success:** Toast notification "Import thành công X sản phẩm", dialog closes, product list refreshes
   - **Error:** Error dialog shows detailed list of errors (row number, field, message), dialog stays open so admin can fix CSV and re-upload
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
- **New file:** `frontend/src/components/CsvImportDialog.tsx` - CSV import dialog component
- **Modified:** `frontend/src/pages/admin/ProductManagement.tsx` - Add "Thêm CSV" button and import dialog
- **Modified:** `frontend/src/services/productApi.ts` - Add `importProductsFromCsv` API function
- **New file:** `frontend/public/sample-product-import.csv` - Sample CSV file for download

### Backend (ProductService)
- **New file:** `ProductService/src/middlewares/csv-upload.middleware.js` - CSV file upload middleware
- **New file:** `ProductService/src/services/csv-import.service.js` - CSV parsing and import logic
- **New file:** `ProductService/src/controllers/csv-import.controller.js` - CSV import controller
- **Modified:** `ProductService/src/routes/product.routes.js` - Add POST /api/products/import-csv route
- **Modified:** `ProductService/package.json` - Add `csv-parse` dependency

### CategoryService (if separate service)
- If category auto-creation needs to call CategoryService, add endpoint or reuse existing create category API
- **Note:** Current architecture has ProductService managing categories via `categoryModel` directly, so no cross-service call needed

## Dependencies

- Backend: `csv-parse` npm package for CSV parsing
- Frontend: No new dependencies (uses existing Dialog, Button, etc. from shadcn/ui)

## Security Considerations

- requireAdmin middleware protects the endpoint
- File size limit (10MB) prevents DoS
- MIME type validation prevents non-CSV uploads
- Base64 image validation prevents malicious payloads
- S3 upload uses existing secure upload flow
- All-or-nothing ensures data consistency

## Testing Strategy

### Backend
- Unit tests for CSV parsing (valid CSV, malformed CSV, missing headers)
- Unit tests for validation rules (each field, edge cases)
- Integration test for full import flow (happy path)
- Integration test for all-or-nothing rollback (error in row N → no products created)
- Test category auto-creation
- Test base64 image decode and S3 upload

### Frontend
- Test file validation (wrong extension, wrong MIME, too large)
- Test drag & drop behavior
- Test success flow (mock API response)
- Test error flow (mock validation errors, check error table rendering)
- Test sample CSV download link
