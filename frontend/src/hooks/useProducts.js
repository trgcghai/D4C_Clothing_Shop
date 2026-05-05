import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getRelatedProducts,
  updateProduct,
} from "../api/products";

export const productQueryKeys = {
  all: ["products"],
  products: (params) => ["products", params],
  product: (id) => ["product", id],
  relatedProducts: (id) => ["relatedProducts", id],
};

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

  const params = buildParams();

  useEffect(() => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) urlParams.set(k, v);
    });
    setSearchParams(urlParams, { replace: true });
  }, [params, setSearchParams]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: productQueryKeys.products(params),
    queryFn: () => getProducts(params),
  });

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
    products: data?.data || [],
    total: data?.total || 0,
    totalPages: data?.totalPages || 0,
    page,
    limit,
    loading: isLoading || isFetching,
    error: error ? error.message : null,
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

export function useProductQuery(productId) {
  return useQuery({
    queryKey: productQueryKeys.product(productId),
    queryFn: () => getProductById(productId),
    enabled: Boolean(productId),
  });
}

export function useRelatedProductsQuery(productId) {
  return useQuery({
    queryKey: productQueryKeys.relatedProducts(productId),
    queryFn: () => getRelatedProducts(productId),
    enabled: Boolean(productId),
  });
}

export function useProductsListQuery(params) {
  return useQuery({
    queryKey: productQueryKeys.products(params),
    queryFn: () => getProducts(params),
  });
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
    },
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => updateProduct(id, formData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: productQueryKeys.product(variables.id) });
        queryClient.invalidateQueries({ queryKey: productQueryKeys.relatedProducts(variables.id) });
      }
    },
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
    },
  });
}
