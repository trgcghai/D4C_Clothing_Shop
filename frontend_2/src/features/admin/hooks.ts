import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Product, ProductListParams } from '@/features/catalog/api'
import { qk } from '@/lib/query/keys'

import {
  createAdminProduct,
  deleteAdminProduct,
  listAdminProducts,
  updateAdminProduct,
  type UpdateProductInput,
} from './api'

const ADMIN_LIST_DEFAULTS: ProductListParams = {
  page: 1,
  limit: 1000,
  sort_by: 'createdAt',
  sort_order: 'desc',
}

export function useAdminProductsQuery(params: ProductListParams = ADMIN_LIST_DEFAULTS) {
  const resolvedParams = {
    page: params.page ?? 1,
    limit: params.limit ?? 1000,
    q: params.q,
    category: params.category,
    gender: params.gender,
    size: params.size,
    color: params.color,
    brand: params.brand,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    sort_by: params.sort_by ?? 'createdAt',
    sort_order: params.sort_order ?? 'desc',
  } as const

  return useQuery({
    queryKey: qk.admin.products(resolvedParams),
    queryFn: () => listAdminProducts(resolvedParams),
  })
}

export function useCreateAdminProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdminProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.all() })
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() })
    },
  })
}

export function useUpdateAdminProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateProductInput) => updateAdminProduct(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.admin.all() })
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() })
      queryClient.invalidateQueries({ queryKey: qk.catalog.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: qk.catalog.related(variables.id) })
    },
  })
}

export function useDeleteAdminProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteAdminProduct(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: qk.admin.all() })
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() })
      queryClient.removeQueries({ queryKey: qk.catalog.detail(id) })
      queryClient.removeQueries({ queryKey: qk.catalog.related(id) })
    },
  })
}

export function getTotalStock(product: Product) {
  return product.stock.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}
