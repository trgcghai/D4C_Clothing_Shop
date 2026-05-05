import { http } from '@/lib/api/http'

export interface ProductStockItem {
  readonly size: string
  readonly quantity: number | string
}

export interface Product {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly price: number | string
  readonly stock: readonly ProductStockItem[]
  readonly category?: string
  readonly gender?: string
  readonly brand?: string
  readonly colors?: readonly string[]
  readonly tags?: readonly string[]
  readonly isFeatured?: boolean
  readonly imageUrl?: string
  readonly createdAt?: string
  readonly updatedAt?: string
}

export interface ProductListParams {
  readonly page?: number
  readonly limit?: number
  readonly q?: string
  readonly category?: string
  readonly gender?: string
  readonly size?: string
  readonly color?: string
  readonly brand?: string
  readonly minPrice?: string
  readonly maxPrice?: string
  readonly sort_by?: string
  readonly sort_order?: 'asc' | 'desc'
}

export interface PaginatedProducts<TProduct = Product> {
  readonly data: readonly TProduct[]
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly totalPages: number
  readonly keyword?: string
}

function buildQueryParams(params: ProductListParams) {
  const query = new URLSearchParams()

  const append = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === '') return
    query.set(key, String(value))
  }

  append('page', params.page)
  append('limit', params.limit)
  append('q', params.q?.trim())
  append('category', params.category)
  append('gender', params.gender)
  append('size', params.size)
  append('color', params.color)
  append('brand', params.brand)
  append('minPrice', params.minPrice)
  append('maxPrice', params.maxPrice)
  append('sort_by', params.sort_by)
  append('sort_order', params.sort_order)

  return query
}

function normalizePaginatedProducts<TProduct>(payload: unknown): PaginatedProducts<TProduct> {
  if (Array.isArray(payload)) {
    return {
      data: payload as TProduct[],
      total: payload.length,
      page: 1,
      limit: payload.length || 12,
      totalPages: 1,
    }
  }

  const result = payload as Partial<PaginatedProducts<TProduct>> & {
    readonly data?: readonly TProduct[]
  }
  const data = Array.isArray(result.data) ? result.data : []

  return {
    data,
    total: Number(result.total) || data.length,
    page: Number(result.page) || 1,
    limit: Number(result.limit) || 12,
    totalPages: Number(result.totalPages) || 1,
    keyword: typeof result.keyword === 'string' ? result.keyword : undefined,
  }
}

export async function getProducts(params: ProductListParams = {}): Promise<PaginatedProducts> {
  const query = buildQueryParams(params)
  const endpoint = params.q?.trim() ? '/api/products/search' : '/api/products'
  const path = query.toString() ? `${endpoint}?${query.toString()}` : endpoint

  const payload = await http<unknown>(path, { method: 'GET' })
  return normalizePaginatedProducts<Product>(payload)
}

export async function getProductById(id: string): Promise<Product> {
  return await http<Product>(`/api/products/${id}`, { method: 'GET' })
}

export async function getRelatedProducts(id: string): Promise<readonly Product[]> {
  const payload = await http<unknown>(`/api/products/${id}/related`, { method: 'GET' })
  return Array.isArray(payload) ? (payload as Product[]) : []
}
