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

const FILTER_FETCH_PAGE_SIZE = 100

function hasAdvancedFilters(params: ProductListParams) {
  return Boolean(
    params.category ||
      params.gender ||
      params.size ||
      params.color ||
      params.brand ||
      params.minPrice ||
      params.maxPrice,
  )
}

function matchesKeyword(product: Product, keyword: string) {
  const kw = keyword.toLowerCase()
  const haystacks = [
    product.name,
    product.description,
    product.category,
    product.brand,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  return haystacks.some((value) => value.includes(kw))
}

async function fetchAllFilteredProducts(params: ProductListParams): Promise<readonly Product[]> {
  const firstQuery = buildQueryParams({
    ...params,
    page: 1,
    limit: FILTER_FETCH_PAGE_SIZE,
  })
  const firstPath = firstQuery.toString() ? `/api/products?${firstQuery.toString()}` : '/api/products'
  const firstPayload = await http<unknown>(firstPath, { method: 'GET' })
  const firstPage = normalizePaginatedProducts<Product>(firstPayload)

  const inferredPages =
    firstPage.totalPages > 1
      ? firstPage.totalPages
      : Math.max(1, Math.ceil(firstPage.total / Math.max(1, firstPage.limit)))

  if (inferredPages <= 1) {
    return firstPage.data
  }

  const pagePromises: Promise<PaginatedProducts<Product>>[] = []
  for (let page = 2; page <= inferredPages; page += 1) {
    const pageQuery = buildQueryParams({
      ...params,
      page,
      limit: FILTER_FETCH_PAGE_SIZE,
    })
    const pagePath = `/api/products?${pageQuery.toString()}`
    pagePromises.push(http<unknown>(pagePath, { method: 'GET' }).then((payload) => normalizePaginatedProducts<Product>(payload)))
  }

  const pages = await Promise.all(pagePromises)
  return [...firstPage.data, ...pages.flatMap((page) => page.data)]
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
  const keyword = params.q?.trim()

  if (keyword && hasAdvancedFilters(params)) {
    const source = await fetchAllFilteredProducts({
      ...params,
      q: undefined,
    })
    const matched = source.filter((product) => matchesKeyword(product, keyword))
    const page = params.page ?? 1
    const limit = params.limit ?? 12
    const start = (page - 1) * limit
    const data = matched.slice(start, start + limit)
    const total = matched.length
    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      keyword,
    }
  }

  const query = buildQueryParams(params)
  const endpoint = keyword ? '/api/products/search' : '/api/products'
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
