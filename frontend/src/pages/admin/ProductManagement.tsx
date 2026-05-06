import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Pencil, Trash2, Search, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/src/hooks/useProducts";
import type {
  Product,
  ProductCreatePayload,
  StockEntry,
} from "@/src/services/productApi";

const PAGE_SIZE = 10;

const defaultForm: ProductCreatePayload = {
  name: "",
  description: "",
  price: 0,
  category: "",
  brand: "",
  gender: "Unisex",
  colors: [],
  stock: [],
  isFeatured: false,
};

const ProductManagement = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductCreatePayload>(defaultForm);
  const [colorInput, setColorInput] = useState("");
  const [stockInput, setStockInput] = useState({ size: "", quantity: "" });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState<string | undefined>();

  const { data, isLoading } = useProducts({
    page,
    limit: PAGE_SIZE,
    sort_by: "createdAt",
    sort_order: "desc",
  });

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const products = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const resetForm = () => {
    setForm(defaultForm);
    setEditingProduct(null);
    setColorInput("");
    setStockInput({ size: "", quantity: "" });
    setImage(null);
    setImagePreview("");
    setImageError(undefined);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

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

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) {
      deleteMutation.mutate(id);
    }
  };

  const addColor = () => {
    if (colorInput.trim() && !form.colors.includes(colorInput.trim())) {
      setForm({ ...form, colors: [...form.colors, colorInput.trim()] });
      setColorInput("");
    }
  };

  const removeColor = (color: string) => {
    setForm({ ...form, colors: form.colors.filter((c) => c !== color) });
  };

  const addStock = () => {
    if (stockInput.size.trim() && stockInput.quantity) {
      const newStock: StockEntry = {
        size: stockInput.size.trim(),
        quantity: Number(stockInput.quantity),
      };
      const existing = form.stock.findIndex((s) => s.size === newStock.size);
      if (existing >= 0) {
        const updated = [...form.stock];
        updated[existing] = newStock;
        setForm({ ...form, stock: updated });
      } else {
        setForm({ ...form, stock: [...form.stock, newStock] });
      }
      setStockInput({ size: "", quantity: "" });
    }
  };

  const removeStock = (size: string) => {
    setForm({ ...form, stock: form.stock.filter((s) => s.size !== size) });
  };

  const totalStock = form.stock.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} sản phẩm</p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog
            open={open}
            onOpenChange={(v) => {
              if (!v) resetForm();
              setOpen(v);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Thêm sản phẩm
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
                </DialogTitle>
                <DialogDescription>
                  Điền thông tin sản phẩm vào form bên dưới.
                </DialogDescription>
              </DialogHeader>
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

                <div className="grid gap-2">
                  <Label htmlFor="name">Tên sản phẩm *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nhập tên sản phẩm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Mô tả sản phẩm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="price">Giá (₫) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={form.price || ""}
                      onChange={(e) =>
                        setForm({ ...form, price: Number(e.target.value) })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Danh mục *</Label>
                    <Input
                      id="category"
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      placeholder="Áo, Quần, ..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="brand">Thương hiệu *</Label>
                    <Input
                      id="brand"
                      value={form.brand}
                      onChange={(e) =>
                        setForm({ ...form, brand: e.target.value })
                      }
                      placeholder="D4C"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Giới tính</Label>
                    <select
                      id="gender"
                      value={form.gender}
                      onChange={(e) =>
                        setForm({ ...form, gender: e.target.value })
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Màu sắc</Label>
                  <div className="flex gap-2">
                    <Input
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="Thêm màu"
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), addColor())
                      }
                    />
                    <Button type="button" variant="outline" onClick={addColor}>
                      Thêm
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {form.colors.map((c) => (
                      <Badge key={c} variant="secondary" className="gap-1">
                        {c}
                        <button
                          type="button"
                          onClick={() => removeColor(c)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Kho hàng</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Size (S, M, L)"
                      value={stockInput.size}
                      onChange={(e) =>
                        setStockInput({ ...stockInput, size: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="SL"
                      value={stockInput.quantity}
                      onChange={(e) =>
                        setStockInput({
                          ...stockInput,
                          quantity: e.target.value,
                        })
                      }
                    />
                    <Button type="button" variant="outline" onClick={addStock}>
                      Thêm
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {form.stock.map((s) => (
                      <Badge key={s.size} variant="outline" className="gap-1">
                        {s.size}: {s.quantity}
                        <button
                          type="button"
                          onClick={() => removeStock(s.size)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tổng tồn: {totalStock}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    checked={form.isFeatured}
                    onChange={(e) =>
                      setForm({ ...form, isFeatured: e.target.checked })
                    }
                    className="size-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isFeatured" className="text-sm">
                    Sản phẩm nổi bật
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Hủy
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    isPending || !form.name || !form.price || !form.category
                  }
                >
                  {isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  {editingProduct ? "Cập nhật" : "Lưu sản phẩm"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm sản phẩm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead>Thương hiệu</TableHead>
              <TableHead>Giá</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead>Nổi bật</TableHead>
              <TableHead className="w-25">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Không có sản phẩm nào
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium max-w-50 truncate">
                    {product.name}
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.brand}</TableCell>
                  <TableCell className="tabular-nums">
                    {product.price.toLocaleString("vi-VN")}₫
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {product.stock?.reduce((s, x) => s + x.quantity, 0) ?? 0}
                  </TableCell>
                  <TableCell>
                    {product.isFeatured ? (
                      <Badge variant="default">Có</Badge>
                    ) : (
                      <Badge variant="secondary">Không</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(product)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(product.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={
                  page <= 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i + 1}>
                <PaginationLink
                  isActive={page === i + 1}
                  onClick={() => setPage(i + 1)}
                  className="cursor-pointer"
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={
                  page >= totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default ProductManagement;
