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
  getRecommendations,
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
  recommendations: (userId: string, limit: number) =>
    [...productKeys.all, "recommendations", userId, limit] as const,
};

// Queries

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters ?? {}),
    queryFn: () => getProducts(filters),
    staleTime: 60_000,
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: productKeys.featured(),
    queryFn: getFeaturedProducts,
    staleTime: 5 * 60_000,
  });
}

export function useNewArrivals(limit = 8) {
  return useQuery({
    queryKey: productKeys.newArrivals(limit),
    queryFn: () => getNewArrivals(limit),
    staleTime: 5 * 60_000,
  });
}

export function useSearchProducts(query: string, options?: SearchOptions) {
  return useQuery({
    queryKey: productKeys.search(query, options),
    queryFn: () => searchProducts(query, options),
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}

export function useProductById(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => getProductById(id),
    staleTime: 60_000,
  });
}

export function useRelatedProducts(id: string) {
  return useQuery({
    queryKey: productKeys.related(id),
    queryFn: () => getRelatedProducts(id),
    staleTime: 5 * 60_000,
  });
}

export function useRecommendations(userId: string | null, limit = 10) {
  return useQuery({
    queryKey: productKeys.recommendations(userId ?? "", limit),
    queryFn: () => getRecommendations(userId!, limit),
    enabled: !!userId,
    staleTime: 2 * 60_000,
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
