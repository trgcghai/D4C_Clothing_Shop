import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";
import { useCategories } from "../hooks/useCategories";
import type { ProductFilters } from "../services/productApi";
import { SlidersHorizontal, X } from "lucide-react";

const GENDERS = ["Nam", "Nữ", "Unisex"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const COLORS = ["Đen", "Trắng", "Xám", "Đỏ", "Xanh Navy", "Xanh Dương", "Xanh Lá", "Vàng", "Hồng", "Nâu"];
const BRANDS = ["Nike", "Adidas", "Zara", "D4C", "H&M", "Uniqlo", "Local Brand"];

const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Mới nhất" },
  { value: "price-asc", label: "Giá thấp → cao" },
  { value: "price-desc", label: "Giá cao → thấp" },
  { value: "name-asc", label: "Tên A → Z" },
];

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  const { data: categories = [] } = useCategories();

  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 12;
  const categoryId = searchParams.get("categoryId") || undefined;
  const gender = searchParams.get("gender") || undefined;
  const size = searchParams.get("size") || undefined;
  const color = searchParams.get("color") || undefined;
  const brand = searchParams.get("brand") || undefined;
  const sort = searchParams.get("sort") || "createdAt-desc";

  const [sortBy, sortOrder] = sort.split("-");

  const filters: ProductFilters = {
    page,
    limit,
    categoryId,
    gender,
    size,
    color,
    brand,
    sort_by: sortBy,
    sort_order: sortOrder as "asc" | "desc",
  };

  const { data, isLoading } = useProducts(filters);

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    setSearchParams(params);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    setSearchParams(params);
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    params.set("sort", sort);
    setSearchParams(params);
    setBrandSearch("");
  };

  const hasFilters = !!(categoryId || gender || size || color || brand);

  const totalPages = data?.totalPages ?? 1;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1);
    }
  }

  const filteredBrands = useMemo(
    () => BRANDS.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase())),
    [brandSearch]
  );

  return (
    <main className="page-wrap px-4 pb-10 pt-8">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Tất cả sản phẩm</h1>
        <p className="text-muted-foreground mt-1">{data?.total ?? 0} sản phẩm</p>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="size-4" />
          Bộ lọc
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 text-destructive hover:text-destructive">
            <X className="size-3.5" />
            Xóa bộ lọc
          </Button>
        )}

        <select
          value={sort}
          onChange={(e) => updateFilter("sort", e.target.value)}
          className="ml-auto h-8 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Sắp xếp"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── Active filter chips ──────────────────────────────────────────────── */}
      {hasFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categoryId && (
            <FilterChip
              label={`Danh mục: ${categories.find(c => c.id === categoryId)?.name ?? categoryId}`}
              onRemove={() => updateFilter("categoryId", null)}
            />
          )}
          {gender && <FilterChip label={`Giới tính: ${gender}`} onRemove={() => updateFilter("gender", null)} />}
          {brand && <FilterChip label={`Thương hiệu: ${brand}`} onRemove={() => updateFilter("brand", null)} />}
          {size && size.split(",").map(s => (
            <FilterChip key={s} label={`Size: ${s}`} onRemove={() => {
              const remaining = size.split(",").filter(x => x !== s).join(",");
              updateFilter("size", remaining || null);
            }} />
          ))}
          {color && color.split(",").map(c => (
            <FilterChip key={c} label={`Màu: ${c}`} onRemove={() => {
              const remaining = color.split(",").filter(x => x !== c).join(",");
              updateFilter("color", remaining || null);
            }} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        {/* ── Filter sidebar ──────────────────────────────────────────────────── */}
        {showFilters && (
          <aside className="w-full shrink-0 md:w-60 space-y-6">

            {/* Category */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Danh mục</h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => updateFilter("categoryId", null)}
                  className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent ${!categoryId ? "bg-accent font-medium" : ""}`}
                >
                  Tất cả danh mục
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => updateFilter("categoryId", cat.id)}
                    className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent ${categoryId === cat.id ? "bg-accent font-medium" : ""}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Giới tính</h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => updateFilter("gender", null)}
                  className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent ${!gender ? "bg-accent font-medium" : ""}`}
                >
                  Tất cả
                </button>
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => updateFilter("gender", g)}
                    className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent ${gender === g ? "bg-accent font-medium" : ""}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Thương hiệu</h3>
              <Input
                placeholder="Tìm thương hiệu..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <div className="space-y-1.5">
                <button
                  onClick={() => updateFilter("brand", null)}
                  className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent ${!brand ? "bg-accent font-medium" : ""}`}
                >
                  Tất cả
                </button>
                {filteredBrands.map((b) => (
                  <button
                    key={b}
                    onClick={() => updateFilter("brand", b)}
                    className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent ${brand === b ? "bg-accent font-medium" : ""}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kích thước</h3>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((s) => {
                  const currentSizes = size ? size.split(",") : [];
                  const isActive = currentSizes.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        let next = [...currentSizes];
                        if (isActive) next = next.filter((x) => x !== s);
                        else next.push(s);
                        updateFilter("size", next.length > 0 ? next.join(",") : null);
                      }}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Màu sắc</h3>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => {
                  const currentColors = color ? color.split(",") : [];
                  const isActive = currentColors.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        let next = [...currentColors];
                        if (isActive) next = next.filter((x) => x !== c);
                        else next.push(c);
                        updateFilter("color", next.length > 0 ? next.join(",") : null);
                      }}
                      className={`flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* ── Product grid ────────────────────────────────────────────────────── */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: limit }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : data?.data && data.data.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {data.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage(Math.max(1, page - 1))}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {pages.map((p, i) => (
                        <PaginationItem key={i}>
                          {p === -1 ? (
                            <span className="flex h-9 w-9 items-center justify-center">...</span>
                          ) : (
                            <PaginationLink
                              isActive={page === p}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center">
              <h2 className="text-xl font-semibold">Không tìm thấy sản phẩm nào.</h2>
              <p className="mt-2 text-muted-foreground">Vui lòng thử điều chỉnh bộ lọc của bạn.</p>
              {hasFilters && (
                <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
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

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-destructive" aria-label="Xóa bộ lọc">
        <X className="size-3" />
      </button>
    </span>
  );
}

export default ProductsPage;
