# Product Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop single image upload to the admin product create/edit form.

**Architecture:** All changes in `ProductManagement.tsx`. Add image state, upload zone UI with drag-and-drop, file validation, and wire to existing `useCreateProduct`/`useUpdateProduct` hooks that already accept `image?: File`.

**Tech Stack:** React 19, TypeScript, shadcn/ui, lucide-react, Tailwind CSS 4

---

### Task 1: Add Image Upload to ProductManagement.tsx

**Files:**
- Modify: `frontend/src/pages/admin/ProductManagement.tsx`

This is a single-task plan. All changes go into one file.

- [ ] **Step 1: Add imports and state**

Add `Upload, X, Image as ImageIcon` to the lucide-react import (line 32):

```tsx
import { Plus, Pencil, Trash2, Search, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
```

Add three new state variables after `stockInput` (around line 66):

```tsx
const [image, setImage] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string>("");
const [isDragOver, setIsDragOver] = useState(false);
const [imageError, setImageError] = useState<string | undefined>();
```

- [ ] **Step 2: Update resetForm()**

Replace the `resetForm` function with:

```tsx
const resetForm = () => {
  setForm(defaultForm);
  setEditingProduct(null);
  setColorInput("");
  setStockInput({ size: "", quantity: "" });
  setImage(null);
  setImagePreview("");
  setImageError(undefined);
};
```

- [ ] **Step 3: Update openEdit()**

Replace the `openEdit` function with:

```tsx
const openEdit = (product: Product) => {
  setEditingProduct(product);
  setForm({
    name: product.name,
    description: product.description || "",
    price: product.price,
    category: product.category,
    brand: product.brand,
    gender: product.gender || "Unisex",
    colors: product.colors || [],
    stock: product.stock || [],
    isFeatured: product.isFeatured || false,
  });
  setImage(null);
  setImagePreview(product.imageUrl || "");
  setImageError(undefined);
  setOpen(true);
};
```

- [ ] **Step 4: Add file validation and handler**

Add these functions before `handleSave` (around line 116):

```tsx
const validateAndSetImage = (file: File) => {
  setImageError(undefined);

  if (!file.type.startsWith("image/")) {
    setImageError("Chỉ hỗ trợ file ảnh (JPG, PNG, WebP)");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setImageError("Kích thước file vượt quá 5MB");
    return;
  }

  setImage(file);
  setImagePreview(URL.createObjectURL(file));
};

const handleImageRemove = () => {
  if (imagePreview.startsWith("blob:")) {
    URL.revokeObjectURL(imagePreview);
  }
  setImage(null);
  setImagePreview(editingProduct ? editingProduct.imageUrl || "" : "");
  setImageError(undefined);
};

const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    validateAndSetImage(file);
  }
  e.target.value = "";
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
  const file = e.dataTransfer.files?.[0];
  if (file) {
    validateAndSetImage(file);
  }
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
};
```

- [ ] **Step 5: Update handleSave()**

Replace the `handleSave` function with:

```tsx
const handleSave = () => {
  if (editingProduct) {
    updateMutation.mutate(
      { id: editingProduct.id, payload: form, image: image || undefined },
      {
        onSuccess: () => {
          if (imagePreview.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreview);
          }
          setOpen(false);
        },
      },
    );
  } else {
    createMutation.mutate(
      { payload: form, image: image || undefined },
      {
        onSuccess: () => {
          if (imagePreview.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreview);
          }
          setOpen(false);
        },
      },
    );
  }
};
```

- [ ] **Step 6: Add upload zone UI in dialog**

Insert the upload zone as the first element inside the `<div className="grid gap-4 py-4">` (after line 202, before the name field). Replace the grid opening section with:

```tsx
<div className="grid gap-4 py-4">
  {/* Image Upload Zone */}
  <div className="flex justify-center">
    <div
      role="button"
      tabIndex={0}
      aria-label="Chọn ảnh sản phẩm"
      className={`relative flex h-40 w-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => document.getElementById("product-image-input")?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          document.getElementById("product-image-input")?.click();
        }
      }}
    >
      <input
        id="product-image-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
        aria-label="Chọn ảnh sản phẩm"
      />

      {imagePreview ? (
        <>
          <img
            src={imagePreview}
            alt="Xem trước ảnh sản phẩm"
            className="h-full w-full rounded-lg object-cover"
          />
          <button
            type="button"
            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
            onClick={(e) => {
              e.stopPropagation();
              handleImageRemove();
            }}
            aria-label="Xóa ảnh"
          >
            <X className="size-3" />
          </button>
          {!image && editingProduct && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-xs text-white opacity-0 transition-opacity hover:opacity-100">
              Nhấn để thay đổi ảnh
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 px-3 text-center">
          <ImageIcon className="size-8 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">
            Kéo thả ảnh hoặc nhấn để chọn
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Hỗ trợ JPG, PNG, WebP. Tối đa 5MB.
          </p>
        </div>
      )}
    </div>
  </div>

  {imageError && (
    <p className="text-center text-xs text-destructive" role="alert">
      {imageError}
    </p>
  )}
```

- [ ] **Step 7: Increase dialog width**

Change the dialog content class from `sm:max-w-xl` to `sm:max-w-2xl` (line 193):

```tsx
<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
```

- [ ] **Step 8: Verify TypeScript compiles**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/admin/ProductManagement.tsx
git commit -m "feat: add image upload to product create/edit form"
```

---

### Task 2: Verify & Test

- [ ] **Step 1: Run full build check**

Run from `frontend/`:
```bash
npm run build
```
Expected: Build succeeds with no errors

- [ ] **Step 2: Manual testing checklist**

Start dev server:
```bash
npm run dev
```

Test the following flows:
1. Navigate to /admin/products as admin
2. Click "Thêm sản phẩm" → dialog opens with empty upload zone
3. Click upload zone → file picker opens → select image → preview shows with X button
4. Drag image onto zone → preview shows
5. Select invalid file type (e.g., .pdf) → error message shown
6. Select file > 5MB → error message shown
7. Click X on preview → upload zone returns to empty state
8. Fill required fields, click "Lưu sản phẩm" → product created with image
9. Verify product appears in list and shows image on ProductCard/ProductDetail
10. Click edit on a product with image → existing image shown as preview
11. Click preview → file picker opens → select new image → preview updates
12. Click X on edited product preview → reverts to original image
13. Edit product without changing image → saves with original image intact
14. Create product without image → saves successfully (no image)

- [ ] **Step 3: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues from manual testing"
```
