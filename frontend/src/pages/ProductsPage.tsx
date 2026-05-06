import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import type { ProductFilters } from "../services/productApi";

const CATEGORIES = ["Áo", "Quần", "Phụ kiện", "Giày", "Váy"];
const GENDERS = ["Nam", "Nữ", "Unisex"];
const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Mới nhất" },
  { value: "price-asc", label: "Giá thấp → cao" },
  { value: "price-desc", label: "Giá cao → thấp" },
  { value: "name-asc", label: "Tên A → Z" },
];

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 12;
  const category = searchParams.get("category") || undefined;
  const gender = searchParams.get("gender") || undefined;
  const sort = searchParams.get("sort") || "createdAt-desc";

  const [sortBy, sortOrder] = sort.split("-");

  const filters: ProductFilters = {
    page,
    limit,
    category,
    gender,
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

  const totalPages = data?.totalPages ?? 1;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1);
    }
  }

  return (
    <main className="page-wrap px-4 pb-10 pt-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tất cả sản phẩm</h1>
        <p className="text-muted-foreground mt-1">
          {data?.total ?? 0} sản phẩm
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? "Ẩn bộ lọc" : "Bộ lọc"}
        </Button>

        <select
          value={sort}
          onChange={(e) => updateFilter("sort", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Sắp xếp"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-lg bg-muted/50">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Danh mục
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!category ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("category", null)}
              >
                Tất cả
              </Button>
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFilter("category", cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Giới tính
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!gender ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter("gender", null)}
              >
                Tất cả
              </Button>
              {GENDERS.map((g) => (
                <Button
                  key={g}
                  variant={gender === g ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFilter("gender", g)}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(page - 1)}
                    className={
                      page <= 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {pages.map((p, idx) =>
                  p === -1 ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <span className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                        ...
                      </span>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => setPage(p)}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage(page + 1)}
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
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Không tìm thấy sản phẩm nào
          </p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => setSearchParams({})}
          >
            Xóa bộ lọc
          </Button>
        </div>
      )}
    </main>
  );
};

export default ProductsPage;
