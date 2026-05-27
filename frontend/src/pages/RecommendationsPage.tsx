import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { useRecommendations } from "../hooks/useProducts";
import { useCategories } from "../hooks/useCategories";
import { useAuth } from "../store";
import { X, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/src/lib/utils";
import CustomPagination from "../components/CustomPagination";
import type { Product } from "../services/productApi";

const GENDERS = ["Nam", "Nữ", "Unisex"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const COLORS = [
  "Đen",
  "Trắng",
  "Xám",
  "Đỏ",
  "Xanh Navy",
  "Xanh Dương",
  "Xanh Lá",
  "Vàng",
  "Hồng",
  "Nâu",
];
const BRANDS = [
  "Nike",
  "Adidas",
  "Zara",
  "D4C",
  "H&M",
  "Uniqlo",
  "Local Brand",
];

const PAGE_SIZE = 12;

const RecommendationsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [brandSearch, setBrandSearch] = useState("");

  const { user, isAuthenticated } = useAuth();
  const { data: categories = [] } = useCategories();

  // Client-side filter state (synced with URL)
  const page = Number(searchParams.get("page")) || 1;
  const categoryId = searchParams.get("categoryId") || undefined;
  const gender = searchParams.get("gender") || undefined;
  const size = searchParams.get("size") || undefined;
  const color = searchParams.get("color") || undefined;
  const brand = searchParams.get("brand") || undefined;

  const { data: allRecs, isLoading } = useRecommendations(
    isAuthenticated && user?.id != null ? String(user.id) : null,
    48,
  );

  // ── Client-side filtering ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!allRecs) return [];
    let items: Product[] = [...allRecs];

    if (categoryId) items = items.filter((p) => p.categoryId === categoryId);
    if (gender) items = items.filter((p) => p.gender === gender);
    if (brand) items = items.filter((p) => p.brand === brand);

    if (size) {
      const sizes = size.split(",");
      items = items.filter((p) =>
        p.variants.some(
          (v) => sizes.includes(v.size) && Number(v.quantity) > 0,
        ),
      );
    }
    if (color) {
      const colors = color.split(",").map((c) => c.toLowerCase());
      items = items.filter((p) =>
        p.variants.some((v) => colors.includes(v.color.toLowerCase())),
      );
    }

    return items;
  }, [allRecs, categoryId, gender, size, color, brand]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    setSearchParams(params);
  };

  const updateMultiFilter = (
    key: string,
    value: string,
    isActive: boolean,
    current: string[],
  ) => {
    const next = isActive
      ? current.filter((x) => x !== value)
      : [...current, value];
    updateFilter(key, next.length > 0 ? next.join(",") : null);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    setSearchParams(params);
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setBrandSearch("");
  };

  const hasFilters = !!(categoryId || gender || size || color || brand);

  const filteredBrands = useMemo(
    () =>
      BRANDS.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase())),
    [brandSearch],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <main className="page-wrap px-4 pb-10 pt-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Sparkles className="size-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Đăng nhập để xem đề xuất</h1>
        <p className="text-muted-foreground">
          Hãy đăng nhập để nhận các gợi ý sản phẩm cá nhân hoá dành riêng cho
          bạn.
        </p>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 pb-10 pt-8">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-5 text-primary" />
          <h1 className="text-3xl font-bold">Sản phẩm đề xuất cho bạn</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          {isLoading
            ? "Đang tải đề xuất..."
            : `${filtered.length} sản phẩm phù hợp với bạn`}
        </p>
      </div>

      <div
        className={cn(
          "mb-4 flex flex-wrap items-center gap-3",
          hasFilters ? "justify-between" : "justify-end",
        )}
      >
        {hasFilters && (
          <div className="flex items-center flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={clearAllFilters}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <X className="size-3.5" />
              Xóa bộ lọc
            </Button>
            {categoryId && (
              <FilterChip
                label={`Danh mục: ${categories.find((c) => c.id === categoryId)?.name ?? categoryId}`}
                onRemove={() => updateFilter("categoryId", null)}
              />
            )}
            {gender && (
              <FilterChip
                label={`Giới tính: ${gender}`}
                onRemove={() => updateFilter("gender", null)}
              />
            )}
            {brand && (
              <FilterChip
                label={`Thương hiệu: ${brand}`}
                onRemove={() => updateFilter("brand", null)}
              />
            )}
            {size &&
              size.split(",").map((s) => (
                <FilterChip
                  key={s}
                  label={`Size: ${s}`}
                  onRemove={() => {
                    const remaining = size
                      .split(",")
                      .filter((x) => x !== s)
                      .join(",");
                    updateFilter("size", remaining || null);
                  }}
                />
              ))}
            {color &&
              color.split(",").map((c) => (
                <FilterChip
                  key={c}
                  label={`Màu: ${c}`}
                  onRemove={() => {
                    const remaining = color
                      .split(",")
                      .filter((x) => x !== c)
                      .join(",");
                    updateFilter("color", remaining || null);
                  }}
                />
              ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="w-full shrink-0 md:w-60 space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Danh mục
            </h3>
            <div className="space-y-1.5">
              <Button
                variant={!categoryId ? "default" : "ghost"}
                onClick={() => updateFilter("categoryId", null)}
                className="block w-full text-left rounded-md px-2 py-1 text-sm"
              >
                Tất cả danh mục
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={categoryId === cat.id ? "default" : "ghost"}
                  onClick={() => updateFilter("categoryId", cat.id)}
                  className="block w-full text-left rounded-md px-2 py-1 text-sm"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Giới tính
            </h3>
            <div className="space-y-1.5">
              <Button
                variant={!gender ? "default" : "ghost"}
                onClick={() => updateFilter("gender", null)}
                className="block w-full text-left rounded-md px-2 py-1 text-sm"
              >
                Tất cả
              </Button>
              {GENDERS.map((g) => (
                <Button
                  key={g}
                  variant={gender === g ? "default" : "ghost"}
                  onClick={() => updateFilter("gender", g)}
                  className="block w-full text-left rounded-md px-2 py-1 text-sm"
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Thương hiệu
            </h3>
            <Input
              placeholder="Tìm thương hiệu..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
            />
            <div className="space-y-1.5">
              <Button
                variant={!brand ? "default" : "ghost"}
                onClick={() => updateFilter("brand", null)}
                className="block w-full text-left rounded-md px-2 py-1 text-sm"
              >
                Tất cả
              </Button>
              {filteredBrands.map((b) => (
                <Button
                  key={b}
                  variant={brand === b ? "default" : "ghost"}
                  onClick={() => updateFilter("brand", b)}
                  className="block w-full text-left rounded-md px-2 py-1 text-sm"
                >
                  {b}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Kích thước
            </h3>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => {
                const current = size ? size.split(",") : [];
                const isActive = current.includes(s);
                return (
                  <Button
                    size="sm"
                    key={s}
                    variant={isActive ? "default" : "outline"}
                    className="flex h-8 min-w-8 items-center justify-center rounded-md border text-xs font-medium"
                    onClick={() =>
                      updateMultiFilter("size", s, isActive, current)
                    }
                  >
                    {s}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Màu sắc
            </h3>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => {
                const current = color ? color.split(",") : [];
                const isActive = current.includes(c);
                return (
                  <Button
                    size="sm"
                    key={c}
                    variant={isActive ? "default" : "outline"}
                    className="flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium"
                    onClick={() =>
                      updateMultiFilter("color", c, isActive, current)
                    }
                  >
                    {c}
                  </Button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : paginated.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {paginated.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <CustomPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          ) : (
            <div className="py-20 text-center">
              <Sparkles className="size-10 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold">
                {hasFilters
                  ? "Không tìm thấy sản phẩm đề xuất phù hợp."
                  : "Chưa có đề xuất cho bạn."}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {hasFilters
                  ? "Thử điều chỉnh bộ lọc của bạn."
                  : "Hãy khám phá thêm sản phẩm để hệ thống hiểu sở thích của bạn!"}
              </p>
              {hasFilters && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={clearAllFilters}
                >
                  Xóa tất cả bộ lọc
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="p-4">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-destructive"
        aria-label="Xóa bộ lọc"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

export default RecommendationsPage;
