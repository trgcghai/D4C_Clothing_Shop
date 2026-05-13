import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProducts,
  getFeaturedProducts,
  getNewArrivals,
  searchProducts,
  getProductById,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductFilters,
  type SearchOptions,
  type ProductCreatePayload,
  type ProductUpdatePayload,
} from "../services/productApi";

// Query Key Factory

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  featured: () => [...productKeys.all, "featured"] as const,
  newArrivals: (limit: number) =>
    [...productKeys.all, "new-arrivals", limit] as const,
  search: (query: string, options?: SearchOptions) =>
    [...productKeys.all, "search", query, options] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  related: (id: string) => [...productKeys.detail(id), "related"] as const,
};

// Queries

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters ?? {}),
    queryFn: () => getProducts(filters),
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: productKeys.featured(),
    queryFn: getFeaturedProducts,
  });
}

export function useNewArrivals(limit = 8) {
  return useQuery({
    queryKey: productKeys.newArrivals(limit),
    queryFn: () => getNewArrivals(limit),
  });
}

export function useSearchProducts(query: string, options?: SearchOptions) {
  return useQuery({
    queryKey: productKeys.search(query, options),
    queryFn: () => searchProducts(query, options),
    enabled: query.length > 0,
  });
}

export function useProductById(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => getProductById(id),
    enabled: !!id,
  });
}

export function useRelatedProducts(id: string) {
  return useQuery({
    queryKey: productKeys.related(id),
    queryFn: () => getRelatedProducts(id),
    enabled: !!id,
  });
}

// Mutations

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      image,
    }: {
      payload: ProductCreatePayload;
      image?: File;
    }) => createProduct(payload, image),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      image,
    }: {
      id: string;
      payload: ProductUpdatePayload;
      image?: File;
    }) => updateProduct(id, payload, image),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.removeQueries({ queryKey: productKeys.detail(id) });
    },
  });
}
