# Product Image Upload Design

**Date:** 2026-05-06
**Status:** Approved

## Overview

Add single image upload capability to the admin product create/edit form in `ProductManagement.tsx`. Backend and API service layer already support image upload — only the admin form UI is missing.

## Backend Contract (Already Implemented)

- **Endpoint:** `POST /api/products` and `PUT /api/products/:id`
- **Content-Type:** `multipart/form-data`
- **File field name:** `productImage`
- **Max size:** 5MB, image/* MIME types only
- **Storage:** S3 bucket, returns `imageUrl` in response
- **Update behavior:** deletes old S3 image, uploads new one

## Frontend API Layer (Already Implemented)

- `createProduct(payload, image?: File)` — builds FormData, appends `productImage`
- `updateProduct(id, payload, image?: File)` — same
- `useCreateProduct()` hook accepts `{ payload, image }`
- `useUpdateProduct()` hook accepts `{ id, payload, image }`

## Changes Required

### File: `frontend/src/pages/admin/ProductManagement.tsx`

**State additions:**
- `image: File | null` — selected file for upload
- `imagePreview: string` — object URL for preview display
- `isDragOver: boolean` — visual highlight state for drag zone

**resetForm() changes:**
- Clear `image` to `null`
- Revoke `imagePreview` object URL to prevent memory leaks

**openEdit(product) changes:**
- Set `image = null` (no local file until user picks)
- Set `imagePreview = product.imageUrl || ""` (show existing image)

**handleSave() changes:**
- Pass `image` to mutations: `createMutation.mutate({ payload: form, image })`
- Pass `image` to mutations: `updateMutation.mutate({ id, payload: form, image })`

**New UI — Upload Zone:**
- Inserted at top of dialog form grid (first element, full-width)
- Dashed border box, ~160x160px, centered
- Hidden `<input type="file" accept="image/*">` triggered by click
- Drag-and-drop support: `onDragOver`, `onDragLeave`, `onDrop`
- File validation: `file.type.startsWith("image/")` and `file.size <= 5 * 1024 * 1024`
- Three visual states:
  1. **Empty:** Upload icon + "Kéo thả ảnh hoặc nhấn để chọn" + "Hỗ trợ JPG, PNG, WebP. Tối đa 5MB."
  2. **Preview (new file):** `<img>` thumbnail with "Xóa" overlay button
  3. **Preview (existing URL in edit mode):** `<img>` with "Nhấn để thay đổi ảnh" hint
- On "Xóa": if editing and product had existing imageUrl, revert to showing it; otherwise show empty state

**Dialog changes:**
- Width increased from `sm:max-w-xl` to `sm:max-w-2xl`

### No New Files

All changes stay within `ProductManagement.tsx`. No new components needed.

## Data Flow

1. User drags or selects image file
2. File validated (type + size)
3. `URL.createObjectURL(file)` generates preview URL
4. `image` state set to File, `imagePreview` set to object URL
5. On save: `image` passed to mutation → `createProduct/updateProduct` builds FormData → backend uploads to S3
6. On success: dialog closes, product list refreshes, object URL revoked

## Error Handling

- Invalid file type → alert "Chỉ hỗ trợ file ảnh (JPG, PNG, WebP)"
- File too large → alert "Kích thước file vượt quá 5MB"
- Upload failure → handled by existing mutation error state

## Accessibility

- Upload zone is clickable div with `role="button"` and `tabIndex={0}`
- Keyboard Enter/Space triggers file picker
- File input has `aria-label="Chọn ảnh sản phẩm"`
- Preview image has `alt="Xem trước ảnh sản phẩm"`
