import { ArrowUpDown, PackageSearch, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import ProductCard from "../components/product-card";
import FilterSidebar from "../components/filter-sidebar";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";
import ProductSkeleton from "../components/ProductSkeleton";
import useProducts from "../hooks/useProducts";

const SORT_OPTIONS = [
  { label: "Mới nhất", sort_by: "createdAt", sort_order: "desc" },
  { label: "Cũ nhất", sort_by: "createdAt", sort_order: "asc" },
  { label: "Giá: Thấp → Cao", sort_by: "price", sort_order: "asc" },
  { label: "Giá: Cao → Thấp", sort_by: "price", sort_order: "desc" },
  { label: "Tên: A → Z", sort_by: "name", sort_order: "asc" },
  { label: "Tên: Z → A", sort_by: "name", sort_order: "desc" },
];

export default function AllProducts() {
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  const {
    products,
    total,
    totalPages,
    page,
    limit,
    loading,
    error,
    filters,
    sortBy,
    sortOrder,
    searchQuery,
    activeFilterCount,
    setPage,
    setSortBy,
    setSortOrder,
    setSearchQuery,
    updateFilter,
    clearFilters,
  } = useProducts();

  const currentSort = SORT_OPTIONS.find(
    (o) => o.sort_by === sortBy && o.sort_order === sortOrder
  ) || SORT_OPTIONS[0];

  const handleSortChange = (e) => {
    const opt = SORT_OPTIONS[Number(e.target.value)];
    setSortBy(opt.sort_by);
    setSortOrder(opt.sort_order);
    setPage(1);
  };

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* ── Page Header ── */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Tất Cả Sản Phẩm</h1>
          {!loading && total > 0 && (
            <p className="text-sm text-gray-500">
              Hiển thị <span className="font-semibold text-gray-700">{startItem}–{endItem}</span> trong{" "}
              <span className="font-semibold text-gray-700">{total}</span> sản phẩm
            </p>
          )}
        </div>

        {/* ── Search + Sort bar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <SearchBar
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setPage(1); }}
            loading={loading && !!searchQuery}
          />

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select
              id="product-sort-select"
              value={SORT_OPTIONS.findIndex((o) => o.sort_by === sortBy && o.sort_order === sortOrder)}
              onChange={handleSortChange}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white
                         focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer
                         text-gray-700 shadow-sm transition-all duration-200"
            >
              {SORT_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowMobileFilter((v) => !v)}
            className="md:hidden flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white
                       shadow-sm text-gray-700 hover:border-purple-400 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Lọc
            {activeFilterCount > 0 && (
              <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Active Filter Tags ── */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(filters).map(([key, val]) => {
              if (!val) return null;
              const keyLabels = {
                category: "Danh mục",
                gender: "Giới tính",
                size: "Size",
                color: "Màu",
                brand: "Thương hiệu",
                minPrice: "Giá từ",
                maxPrice: "Giá đến",
              };
              const displayVal = key === "minPrice" || key === "maxPrice"
                ? `${Number(val).toLocaleString("vi-VN")}₫`
                : val;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200
                             text-purple-700 text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  <span className="text-purple-400">{keyLabels[key]}:</span>
                  {displayVal}
                  <button
                    onClick={() => {
                      if (key === "minPrice") { updateFilter("minPrice", ""); updateFilter("maxPrice", ""); }
                      else updateFilter(key, "");
                    }}
                    className="text-purple-400 hover:text-purple-700 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* ── Main Layout ── */}
        <div className="flex flex-col md:flex-row gap-8">

          {/* Sidebar (desktop always visible, mobile toggleable) */}
          <aside className={`md:w-64 flex-shrink-0 ${showMobileFilter ? "block" : "hidden md:block"}`}>
            <div className="bg-white rounded-2xl p-5 shadow-sm sticky top-4">
              <FilterSidebar
                filters={filters}
                updateFilter={updateFilter}
                clearFilters={clearFilters}
                activeFilterCount={activeFilterCount}
              />
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {/* Error state */}
            {error && (
              <div className="text-center py-16 text-red-500">
                <p className="text-lg font-medium">Có lỗi xảy ra</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <ProductSkeleton count={12} />
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <PackageSearch className="w-16 h-16 mb-4 opacity-40" />
                <p className="text-lg font-medium text-gray-500">Không tìm thấy sản phẩm</p>
                <p className="text-sm mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-sm text-purple-600 hover:text-purple-800 font-medium underline"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                )}
              </div>
            )}

            {/* Product grid */}
            {!loading && products.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    setPage(p);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
