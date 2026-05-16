import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProductPagination from "@/src/components/CustomPagination";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Image as ImageIcon,
  Package,
} from "lucide-react";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/src/hooks/useProducts";
import { useCategories } from "@/src/hooks/useCategories";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import type {
  Product,
  ProductCreatePayload,
  Variant,
} from "@/src/services/productApi";

const PAGE_SIZE = 10;
const GENDERS = ["Nam", "Nữ", "Unisex"];
const BRANDS = [
  "Nike",
  "Adidas",
  "Zara",
  "D4C",
  "H&M",
  "Uniqlo",
  "Local Brand",
];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const defaultForm: ProductCreatePayload = {
  name: "",
  description: "",
  price: 0,
  categoryId: "",
  brand: "",
  gender: "Unisex",
  variants: [],
  tags: [],
  isFeatured: false,
};
const defaultVariant: Variant = { color: "", size: "", quantity: 0 };

export default function ProductManagement() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductCreatePayload>(defaultForm);
  const [variantInput, setVariantInput] = useState<Variant>(defaultVariant);
  const [tagInput, setTagInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState<string | undefined>();

  const { data: categoriesData = [] } = useCategories();
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

  const resetForm = () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setForm(defaultForm);
    setEditingProduct(null);
    setVariantInput(defaultVariant);
    setTagInput("");
    setImage(null);
    setImagePreview("");
    setImageError(undefined);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price,
      categoryId: p.categoryId,
      brand: p.brand,
      gender: p.gender || "Unisex",
      variants: p.variants || [],
      tags: p.tags || [],
      isFeatured: p.isFeatured || false,
    });
    setImage(null);
    setImagePreview(p.imageUrl || "");
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

  const handleSave = () => {
    const payload = {
      ...form,
      variants: form.variants.map((v) => ({
        ...v,
        quantity: Number(v.quantity),
      })),
    };
    if (editingProduct) {
      updateMutation.mutate(
        { id: editingProduct.id, payload, image: image || undefined },
        {
          onSuccess: () => {
            if (imagePreview.startsWith("blob:"))
              URL.revokeObjectURL(imagePreview);
            setOpen(false);
          },
        },
      );
    } else {
      createMutation.mutate(
        { payload, image: image || undefined },
        {
          onSuccess: () => {
            if (imagePreview.startsWith("blob:"))
              URL.revokeObjectURL(imagePreview);
            setOpen(false);
          },
        },
      );
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này?"))
      deleteMutation.mutate(id);
  };

  const addVariant = () => {
    if (!variantInput.color.trim() || !variantInput.size.trim()) return;
    const nv = {
      color: variantInput.color.trim(),
      size: variantInput.size.trim(),
      quantity: Number(variantInput.quantity),
    };
    const idx = form.variants.findIndex(
      (v) =>
        v.color.toLowerCase() === nv.color.toLowerCase() &&
        v.size.toLowerCase() === nv.size.toLowerCase(),
    );
    if (idx >= 0) {
      const updated = [...form.variants];
      updated[idx] = nv;
      setForm({ ...form, variants: updated });
    } else {
      setForm({ ...form, variants: [...form.variants, nv] });
    }
    setVariantInput(defaultVariant);
  };

  const removeVariant = (i: number) =>
    setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) });

  const addTag = () => {
    if (tagInput.trim() && !form.tags?.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...(form.tags || []), tagInput.trim()] });
      setTagInput("");
    }
  };

  const totalStock = (p: Product) =>
    (p.variants || []).reduce((s, v) => s + Number(v.quantity), 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="size-6 text-primary" />
            Quản lý sản phẩm
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.total ?? 0} sản phẩm
          </p>
        </div>

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

          <DialogContent className="sm:max-w-225 max-h-[90vh] p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="text-xl font-semibold">
                {editingProduct ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
              </DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto max-h-[calc(90vh-140px)] [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.28)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <ImageIcon className="size-4 text-muted-foreground" />
                        Hình ảnh sản phẩm
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {imagePreview ? (
                        <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="size-full object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute right-2 top-2 size-8 shadow-lg"
                            onClick={() => {
                              if (imagePreview.startsWith("blob:"))
                                URL.revokeObjectURL(imagePreview);
                              setImage(null);
                              setImagePreview(editingProduct?.imageUrl || "");
                            }}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragOver(true);
                          }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragOver(false);
                            const f = e.dataTransfer.files?.[0];
                            if (f) validateAndSetImage(f);
                          }}
                          className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${isDragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"}`}
                        >
                          <div className="rounded-full bg-muted p-3 mb-3">
                            <ImageIcon className="size-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            Kéo thả ảnh vào đây
                          </p>
                          <label className="mt-2 cursor-pointer text-sm text-primary hover:underline font-medium">
                            Hoặc chọn tệp
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) validateAndSetImage(f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <p className="mt-2 text-xs text-muted-foreground">
                            JPG, PNG, WebP · Tối đa 5MB
                          </p>
                        </div>
                      )}
                      {imageError && (
                        <p className="mt-2 text-sm text-destructive flex items-center gap-1">
                          <span className="text-base">⚠</span> {imageError}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Package className="size-4 text-muted-foreground" />
                        Thông tin sản phẩm
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="pm-name">
                          Tên sản phẩm{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="pm-name"
                          placeholder="Ví dụ: Áo Thun Basic Nike"
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="pm-price">
                          Giá bán (VNĐ){" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="pm-price"
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="250000"
                          value={form.price}
                          onChange={(e) =>
                            setForm({ ...form, price: Number(e.target.value) })
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label>
                            Danh mục <span className="text-destructive">*</span>
                          </Label>
                          <Link
                            to="/admin/categories"
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Quản lý danh mục
                          </Link>
                        </div>
                        <Select
                          value={form.categoryId}
                          onValueChange={(val) =>
                            setForm({ ...form, categoryId: val })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn danh mục..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categoriesData.length === 0 ? (
                              <SelectItem value="__empty__" disabled>
                                Đang tải danh mục...
                              </SelectItem>
                            ) : (
                              categoriesData.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {categoriesData.length === 0 && (
                          <p className="text-xs text-amber-600">
                            ⚠️ Không tải được danh mục — kiểm tra kết nối server
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>
                            Thương hiệu{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={form.brand}
                            onValueChange={(val) =>
                              setForm({ ...form, brand: val })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn..." />
                            </SelectTrigger>
                            <SelectContent>
                              {BRANDS.map((b) => (
                                <SelectItem key={b} value={b}>
                                  {b}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Giới tính</Label>
                          <Select
                            value={form.gender}
                            onValueChange={(val) =>
                              setForm({ ...form, gender: val })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((g) => (
                                <SelectItem key={g} value={g}>
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="pm-desc">Mô tả sản phẩm</Label>
                        <Textarea
                          id="pm-desc"
                          rows={4}
                          placeholder="Mô tả chi tiết về chất liệu, kiểu dáng, phù hợp dịp nào..."
                          value={form.description}
                          onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id="pm-featured"
                          checked={!!form.isFeatured}
                          onCheckedChange={(c: boolean) =>
                            setForm({ ...form, isFeatured: c })
                          }
                        />
                        <Label
                          htmlFor="pm-featured"
                          className="cursor-pointer text-sm"
                        >
                          Đánh dấu sản phẩm nổi bật
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">
                        Biến thể <span className="text-destructive">*</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="grid gap-1.5">
                            <Label className="text-xs font-medium">
                              Màu sắc
                            </Label>
                            <Input
                              placeholder="Đen, Trắng..."
                              value={variantInput.color}
                              onChange={(e) =>
                                setVariantInput({
                                  ...variantInput,
                                  color: e.target.value,
                                })
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && addVariant()
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs font-medium">
                              Kích thước
                            </Label>
                            <Select
                              value={variantInput.size}
                              onValueChange={(v) =>
                                setVariantInput({ ...variantInput, size: v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Size..." />
                              </SelectTrigger>
                              <SelectContent>
                                {SIZES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs font-medium">
                              Số lượng
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={variantInput.quantity || ""}
                              onChange={(e) =>
                                setVariantInput({
                                  ...variantInput,
                                  quantity: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={addVariant}
                          disabled={
                            !variantInput.color.trim() ||
                            !variantInput.size.trim()
                          }
                        >
                          <Plus className="mr-1.5 size-3.5" />
                          Thêm biến thể
                        </Button>
                      </div>

                      {form.variants.length > 0 ? (
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="py-2 text-xs font-medium">
                                  Màu
                                </TableHead>
                                <TableHead className="py-2 text-xs font-medium">
                                  Size
                                </TableHead>
                                <TableHead className="py-2 text-xs font-medium">
                                  SL
                                </TableHead>
                                <TableHead className="py-2 w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {form.variants.map((v, i) => (
                                <TableRow key={i} className="hover:bg-muted/30">
                                  <TableCell className="py-2.5 text-sm">
                                    {v.color}
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs font-medium"
                                    >
                                      {v.size}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-2.5 text-sm font-medium tabular-nums">
                                    {v.quantity}
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeVariant(i)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground border-t flex justify-between font-medium">
                            <span>{form.variants.length} biến thể</span>
                            <span className="tabular-nums">
                              Tổng:{" "}
                              {form.variants.reduce(
                                (s, v) => s + Number(v.quantity),
                                0,
                              )}{" "}
                              sản phẩm
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 border rounded-lg border-dashed border-muted-foreground/25">
                          <Package className="size-8 text-muted-foreground/50 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Chưa có biến thể nào
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Thêm ít nhất 1 biến thể để tiếp tục
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">
                        Tags
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Từ khoá tìm kiếm cho sản phẩm
                      </p>
                      <div className="flex gap-2">
                        <Input
                          className="text-sm"
                          placeholder="Nhập tag và nhấn Enter..."
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && (e.preventDefault(), addTag())
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addTag}
                          disabled={!tagInput.trim()}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 min-h-8">
                        {form.tags?.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="text-xs gap-1.5 pr-1.5"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  tags: form.tags?.filter((x) => x !== t) || [],
                                })
                              }
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                        {(!form.tags || form.tags.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">
                            Chưa có tag nào
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 pb-8 border-t bg-muted/30">
              <div className="flex items-center gap-4 mr-auto">
                {form.variants.length === 0 && (
                  <span className="text-destructive text-xs font-medium flex items-center gap-1">
                    <span>⚠</span> Cần ít nhất 1 biến thể
                  </span>
                )}
                {!form.categoryId && (
                  <span className="text-destructive text-xs font-medium flex items-center gap-1">
                    <span>⚠</span> Cần chọn danh mục
                  </span>
                )}
                {!form.name && (
                  <span className="text-destructive text-xs font-medium flex items-center gap-1">
                    <span>⚠</span> Cần nhập tên
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  isPending ||
                  !form.name ||
                  !form.price ||
                  !form.categoryId ||
                  form.variants.length === 0
                }
              >
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editingProduct ? "Cập nhật sản phẩm" : "Lưu sản phẩm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-15">Ảnh</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead>Thương hiệu</TableHead>
              <TableHead>Giá</TableHead>
              <TableHead>Biến thể</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead>Nổi bật</TableHead>
              <TableHead className="w-22.5">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-12 text-muted-foreground"
                >
                  Không có sản phẩm nào
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="size-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded bg-muted">
                        <ImageIcon className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-45 truncate">
                    {p.name}
                  </TableCell>
                  <TableCell>
                    {p.category ? (
                      <Badge variant="secondary" className="text-xs">
                        {p.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">---</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{p.brand}</TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {formatCurrency(p.price)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.variants?.length ?? 0} biến thể
                  </TableCell>
                  <TableCell className="font-medium tabular-nums text-sm">
                    {totalStock(p)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.isFeatured ? "default" : "outline"}
                      className="text-xs"
                    >
                      {p.isFeatured ? "Có" : "Không"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleDelete(p.id)}
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

      <ProductPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
