export interface CatalogListKeyParams {
  readonly page: number
  readonly q?: string
}

function normalizeCatalogListParams(params: CatalogListKeyParams) {
  return params.q ? { page: params.page, q: params.q } : { page: params.page }
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
  },
  admin: {
    all: () => ['admin'] as const,
  },
} as const
