import { keepPreviousData, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { qk } from '@/lib/query/keys'

import { getProductById, getProducts, getRelatedProducts } from './api'
import type { ProductListParams } from './api'

export function catalogListQueryOptions(params: ProductListParams) {
  return queryOptions({
    queryKey: qk.catalog.list({
      page: params.page ?? 1,
      limit: params.limit ?? 12,
      q: params.q,
      category: params.category,
      gender: params.gender,
      size: params.size,
      color: params.color,
      brand: params.brand,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
    }),
    queryFn: () => getProducts(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function catalogProductQueryOptions(productId: string) {
  return queryOptions({
    queryKey: qk.catalog.detail(productId),
    queryFn: () => getProductById(productId),
    staleTime: 5 * 60_000,
  })
}

export function catalogRelatedProductsQueryOptions(productId: string) {
  return queryOptions({
    queryKey: qk.catalog.related(productId),
    queryFn: () => getRelatedProducts(productId),
    staleTime: 5 * 60_000,
  })
}

export function useCatalogProductsQuery(params: ProductListParams) {
  return useQuery(catalogListQueryOptions(params))
}

export function useCatalogProductQuery(productId: string) {
  return useQuery({
    ...catalogProductQueryOptions(productId),
    enabled: Boolean(productId),
  })
}

export function useCatalogRelatedProductsQuery(productId: string) {
  return useQuery({
    ...catalogRelatedProductsQueryOptions(productId),
    enabled: Boolean(productId),
  })
}

export function usePrefetchCatalogProductDetail() {
  const queryClient = useQueryClient()

  return (productId: string) => {
    if (!productId) return
    void queryClient.prefetchQuery(catalogProductQueryOptions(productId))
  }
}

export function prefetchCatalogProductDetail(queryClient: QueryClient, productId: string) {
  if (!productId) return Promise.resolve(undefined)
  return queryClient.prefetchQuery(catalogProductQueryOptions(productId))
}
