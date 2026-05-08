import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Pencil, Trash2, Search, Loader2, LayoutGrid, X, Image as ImageIcon } from "lucide-react";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/src/hooks/useCategories";
import type { Category, CategoryCreatePayload } from "@/src/services/categoryApi";

const defaultForm: CategoryCreatePayload = {
  name: "",
  description: "",
  imageUrl: "",
};

export default function CategoryManagement() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryCreatePayload>(defaultForm);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState<string | undefined>();

  const { data: categories = [], isLoading } = useCategories();

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setForm(defaultForm);
    setEditingCategory(null);
    setImage(null);
    setImagePreview("");
    setImageError(undefined);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description || "",
      imageUrl: category.imageUrl || "",
    });
    setImage(null);
    setImagePreview(category.imageUrl || "");
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
    if (editingCategory) {
      updateMutation.mutate(
        { id: editingCategory.id, payload: form, image: image || undefined },
        {
          onSuccess: () => {
            if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
            setOpen(false);
          },
        }
      );
    } else {
      createMutation.mutate(
        { payload: form, image: image || undefined },
        {
          onSuccess: () => {
            if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
            setOpen(false);
          },
        }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa danh mục này? Điều này có thể ảnh hưởng đến các sản phẩm đang thuộc danh mục này.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="size-6 text-primary" />
            Quản lý danh mục
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {categories.length} danh mục hiện có
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
              Thêm danh mục
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b bg-muted/20">
              <DialogTitle className="text-xl">
                {editingCategory ? "✏️ Chỉnh sửa danh mục" : "➕ Thêm danh mục mới"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Cấu hình thông tin cơ bản và hình ảnh đại diện cho danh mục.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left Column: Image */}
              <div className="p-6 border-b md:border-b-0 md:border-r bg-muted/5 flex flex-col gap-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <ImageIcon className="size-4" />
                  Hình ảnh đại diện
                </Label>
                
                {imagePreview ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-background shadow-sm group">
                    <img src={imagePreview} alt="Preview" className="size-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Button
                        variant="destructive"
                        size="sm"
                        className="size-8 rounded-full p-0"
                        onClick={() => {
                          if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
                          setImage(null);
                          setImagePreview(editingCategory?.imageUrl || "");
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndSetImage(f); }}
                    className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-accent"}`}
                  >
                    <ImageIcon className="mb-2 size-10 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground font-medium text-center px-4">Kéo thả ảnh hoặc click để chọn</p>
                    <label className="mt-3 cursor-pointer">
                      <Button variant="outline" size="sm" asChild>
                        <span>Chọn tệp</span>
                      </Button>
                      <input type="file" className="hidden" accept="image/*"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetImage(f); e.target.value = ""; }} />
                    </label>
                    <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-wider">JPG, PNG, WebP · Max 5MB</p>
                  </div>
                )}
                {imageError && <p className="text-xs text-destructive font-medium text-center">{imageError}</p>}
                
                <p className="text-[11px] text-muted-foreground italic mt-auto">
                  * Ảnh này sẽ hiển thị ở trang chủ và các bộ lọc tìm kiếm.
                </p>
              </div>

              {/* Right Column: Info */}
              <div className="p-6 space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="cat-name" className="text-sm font-semibold">Tên danh mục <span className="text-destructive">*</span></Label>
                  <Input
                    id="cat-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ví dụ: Áo khoác, Giày thể thao..."
                    className="h-10 focus-visible:ring-primary"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="cat-desc" className="text-sm font-semibold">Mô tả chi tiết</Label>
                  <Textarea
                    id="cat-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Mô tả ngắn gọn về đặc điểm của các sản phẩm trong danh mục này..."
                    className="min-h-[160px] resize-none focus-visible:ring-primary"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/20">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isPending || !form.name.trim()}
                className="px-8"
              >
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editingCategory ? "Cập nhật thay đổi" : "Tạo danh mục"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Tìm nhanh danh mục..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 border-muted-foreground/20 focus-visible:ring-primary"
        />
      </div>

      <div className="rounded-xl border shadow-sm overflow-hidden bg-card border-muted-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b-muted-foreground/10">
              <TableHead className="w-[100px] font-semibold text-foreground">Ảnh</TableHead>
              <TableHead className="font-semibold text-foreground">Tên danh mục</TableHead>
              <TableHead className="font-semibold text-foreground">Mô tả</TableHead>
              <TableHead className="font-semibold w-[120px] text-right text-foreground">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="size-12 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell><div className="flex justify-end gap-2"><Skeleton className="size-8 rounded-md" /><Skeleton className="size-8 rounded-md" /></div></TableCell>
                </TableRow>
              ))
            ) : filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-20 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-16 rounded-full bg-muted flex items-center justify-center">
                      <LayoutGrid className="size-8 opacity-20" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">Không tìm thấy kết quả</p>
                      <p className="text-sm">Thử thay đổi từ khóa tìm kiếm của bạn</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => (
                <TableRow key={category.id} className="hover:bg-muted/20 transition-colors border-b-muted-foreground/10">
                  <TableCell>
                    {category.imageUrl ? (
                      <div className="size-12 rounded-lg overflow-hidden border border-muted-foreground/10 bg-muted shadow-inner">
                        <img src={category.imageUrl} alt={category.name} className="size-full object-cover" />
                      </div>
                    ) : (
                      <div className="size-12 rounded-lg bg-muted flex items-center justify-center border border-dashed border-muted-foreground/20">
                        <ImageIcon className="size-5 text-muted-foreground opacity-40" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-foreground">
                    {category.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate text-sm">
                    {category.description || <span className="italic opacity-40">Chưa có nội dung mô tả...</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                        onClick={() => openEdit(category)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 hover:bg-destructive/10 hover:text-destructive transition-all active:scale-90"
                        onClick={() => handleDelete(category.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
