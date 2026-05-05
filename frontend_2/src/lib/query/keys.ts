export interface CatalogListKeyParams {
  readonly page: number
  readonly limit: number
  readonly q?: string
  readonly category?: string
  readonly gender?: string
  readonly size?: string
  readonly color?: string
  readonly brand?: string
  readonly minPrice?: string
  readonly maxPrice?: string
  readonly sort_by?: string
  readonly sort_order?: string
}

function normalizeCatalogListParams(params: CatalogListKeyParams) {
  const normalized: Record<string, string | number> = {
    page: params.page,
    limit: params.limit,
  }

  if (params.q) normalized.q = params.q
  if (params.category) normalized.category = params.category
  if (params.gender) normalized.gender = params.gender
  if (params.size) normalized.size = params.size
  if (params.color) normalized.color = params.color
  if (params.brand) normalized.brand = params.brand
  if (params.minPrice) normalized.minPrice = params.minPrice
  if (params.maxPrice) normalized.maxPrice = params.maxPrice
  if (params.sort_by) normalized.sort_by = params.sort_by
  if (params.sort_order) normalized.sort_order = params.sort_order

  return normalized
}

export const qk = {
  auth: {
    all: () => ['auth'] as const,
    me: () => ['auth', 'me'] as const,
  },
  catalog: {
    all: () => ['catalog'] as const,
    list: (params: CatalogListKeyParams) => ['catalog', 'list', normalizeCatalogListParams(params)] as const,
    detail: (id: string) => ['catalog', 'detail', id] as const,
    related: (id: string) => ['catalog', 'related', id] as const,
  },
  admin: {
    all: () => ['admin'] as const,
    products: (params: CatalogListKeyParams) => ['admin', 'products', normalizeCatalogListParams(params)] as const,
  },
} as const
