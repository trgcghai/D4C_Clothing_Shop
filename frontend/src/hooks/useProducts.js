import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const DEFAULT_FILTERS = {
  category: "",
  gender: "",
  size: "",
  color: "",
  brand: "",
  minPrice: "",
  maxPrice: "",
};

const DEFAULT_OPTIONS = {
  sort_by: "createdAt",
  sort_order: "desc",
  page: 1,
  limit: 12,
};

/**
 * Custom hook for product listing with server-side filtering, sorting, search, pagination.
 * Syncs state with URL search params so filters survive page refresh.
 */
export default function useProducts() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Initialize state from URL ────────────────────────────────────────────────
  const initFromUrl = (key, fallback) => searchParams.get(key) || fallback;

  const [filters, setFilters] = useState({
    category: initFromUrl("category", ""),
    gender: initFromUrl("gender", ""),
    size: initFromUrl("size", ""),
    color: initFromUrl("color", ""),
    brand: initFromUrl("brand", ""),
    minPrice: initFromUrl("minPrice", ""),
    maxPrice: initFromUrl("maxPrice", ""),
  });

  const [sortBy, setSortBy] = useState(initFromUrl("sort_by", DEFAULT_OPTIONS.sort_by));
  const [sortOrder, setSortOrder] = useState(initFromUrl("sort_order", DEFAULT_OPTIONS.sort_order));
  const [page, setPage] = useState(Number(initFromUrl("page", DEFAULT_OPTIONS.page)));
  const [limit] = useState(DEFAULT_OPTIONS.limit);

  const [searchQuery, setSearchQuery] = useState(initFromUrl("q", ""));
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // ── Results ──────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Debounce search ──────────────────────────────────────────────────────────
  const debounceTimer = useRef(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset page on new search
    }, 350);
    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  // ── Build query string & sync URL ────────────────────────────────────────────
  const buildParams = useCallback(() => {
    const params = {};
    if (debouncedSearch) params.q = debouncedSearch;
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    params.sort_by = sortBy;
    params.sort_order = sortOrder;
    params.page = page;
    params.limit = limit;
    return params;
  }, [debouncedSearch, filters, sortBy, sortOrder, page, limit]);

  // ── Fetch products ────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = buildParams();

    // Sync URL
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) urlParams.set(k, v); });
    setSearchParams(urlParams, { replace: true });

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        let url;
        if (params.q) {
          // Use search endpoint
          const qp = new URLSearchParams(params);
          url = `${API_URL}/products/search?${qp.toString()}`;
        } else {
          // Use filter endpoint
          const qp = new URLSearchParams(params);
          url = `${API_URL}/products?${qp.toString()}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Lỗi khi tải sản phẩm");
        const json = await res.json();

        setProducts(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      } catch (err) {
        setError(err.message);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [buildParams, setSearchParams]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery("");
    setDebouncedSearch("");
    setSortBy(DEFAULT_OPTIONS.sort_by);
    setSortOrder(DEFAULT_OPTIONS.sort_order);
    setPage(1);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return {
    // State
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
    // Actions
    setPage,
    setSortBy,
    setSortOrder,
    setSearchQuery,
    updateFilter,
    clearFilters,
  };
}
