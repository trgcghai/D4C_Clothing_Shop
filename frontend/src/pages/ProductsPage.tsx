import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";
import { useSearchResults } from "@/src/hooks/useSearchResults";
import { useCategories } from "../hooks/useCategories";
import type { ProductFilters } from "../services/productApi";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/src/lib/utils";
import CustomPagination from "../components/CustomPagination";

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

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [brandSearch, setBrandSearch] = useState("");

  const { data: categories = [] } = useCategories();

  const searchQuery = searchParams.get("search") || undefined;

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

  const { data: dataFromProducts, isLoading: isLoadingFromProducts } =
    useProducts(filters);

  const searchOptions = useMemo(
    () => ({
      page,
      limit,
      sort_by: sort,
    }),
    [page, limit, sort],
  );

  const { data: searchData, isLoading: searchLoading } = useSearchResults(
    searchQuery ?? "",
    searchOptions,
  );

  const data = searchQuery ? searchData : dataFromProducts;
  const isLoading = searchQuery ? searchLoading : isLoadingFromProducts;

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

  const updateMultipleValuesFilter = (
    key: string,
    value: string,
    isActive: boolean,
    currentValues: string[],
  ) => {
    let next = [...currentValues];
    if (isActive) next = next.filter((x) => x !== value);
    else next.push(value);
    updateFilter(key, next.length > 0 ? next.join(",") : null);
  };

  const hasFilters = !!(categoryId || gender || size || color || brand);

  const totalPages = data?.totalPages ?? 1;

  const renderedSizes = useMemo(() => {
    return SIZES.map((s) => {
      const currentSizes = size ? size.split(",") : [];
      const isActive = currentSizes.includes(s);

      return {
        s,
        currentSizes,
        isActive,
      };
    });
  }, [size]);

  const renderedColors = useMemo(() => {
    return COLORS.map((c) => {
      const currentColors = color ? color.split(",") : [];
      const isActive = currentColors.includes(c);
      return {
        c,
        currentColors,
        isActive,
      };
    });
  }, [color]);

  const filteredBrands = useMemo(
    () =>
      BRANDS.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase())),
    [brandSearch],
  );

  return (
    <main className="page-wrap px-4 pb-10 pt-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">
          {searchQuery
            ? `Kết quả tìm kiếm cho "${searchQuery}"`
            : "Tất cả sản phẩm"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {data?.total ?? 0} sản phẩm
          {searchQuery && data && "searchTimeMs" in data && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({data.searchTimeMs}ms)
            </span>
          )}
        </p>
      </div>

      <div
        className={cn(
          "mb-4 flex flex-wrap items-center gap-3",
          hasFilters || searchQuery ? "justify-between" : "justify-end",
        )}
      >
        {(hasFilters || searchQuery) && (
          <div className="flex items-center flex-wrap gap-2">
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete("search");
                  setSearchParams(params);
                }}
                className="gap-1"
              >
                <X className="size-3.5" />
                Xóa tìm kiếm
              </Button>
            )}
            {hasFilters && (
              <Button
                variant="destructive"
                onClick={clearAllFilters}
                className="gap-1 text-destructive hover:text-destructive"
              >
                <X className="size-3.5" />
                Xóa bộ lọc
              </Button>
            )}

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
                className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors`}
              >
                Tất cả danh mục
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={categoryId === cat.id ? "default" : "ghost"}
                  onClick={() => updateFilter("categoryId", cat.id)}
                  className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors`}
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
                className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors`}
              >
                Tất cả
              </Button>
              {GENDERS.map((g) => (
                <Button
                  key={g}
                  variant={gender === g ? "default" : "ghost"}
                  onClick={() => updateFilter("gender", g)}
                  className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors`}
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
                className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors`}
              >
                Tất cả
              </Button>
              {filteredBrands.map((b) => (
                <Button
                  key={b}
                  variant={brand === b ? "default" : "ghost"}
                  onClick={() => updateFilter("brand", b)}
                  className={`block w-full text-left rounded-md px-2 py-1 text-sm transition-colors`}
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
              {renderedSizes.map(({ s, isActive, currentSizes }) => {
                return (
                  <Button
                    size="sm"
                    key={s}
                    variant={isActive ? "default" : "outline"}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors`}
                    onClick={() =>
                      updateMultipleValuesFilter(
                        "size",
                        s,
                        isActive,
                        currentSizes,
                      )
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
              {renderedColors.map(({ c, isActive, currentColors }) => {
                return (
                  <Button
                    size="sm"
                    key={c}
                    variant={isActive ? "default" : "outline"}
                    className={`flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors`}
                    onClick={() =>
                      updateMultipleValuesFilter(
                        "color",
                        c,
                        isActive,
                        currentColors,
                      )
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

              <CustomPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          ) : (
            <div className="py-20 text-center">
              {searchQuery ? (
                <>
                  <h2 className="text-xl font-semibold">
                    Không tìm thấy sản phẩm nào cho "{searchQuery}"
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Thử tìm với từ khóa khác hoặc{" "}
                    <Link
                      to="/products"
                      className="text-primary hover:underline"
                    >
                      xem tất cả sản phẩm
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold">
                    Không tìm thấy sản phẩm nào.
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Vui lòng thử điều chỉnh bộ lọc của bạn.
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
                </>
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

export default ProductsPage;
