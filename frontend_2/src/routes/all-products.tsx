import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { ProductCard } from '@/features/catalog/components/product-card'
import { CatalogFilters } from '@/features/catalog/components/catalog-filters'
import { CatalogEmptyState, CatalogErrorState } from '@/features/catalog/components/catalog-states'
import { CatalogGridSkeleton } from '@/features/catalog/components/catalog-skeleton'
import { useCatalogProductsQuery } from '@/features/catalog/hooks'
import type { ProductListParams } from '@/features/catalog/api'

interface CatalogRouteSearch {
  q?: string
  category?: string
  gender?: string
  size?: string
  color?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

const DEFAULTS = {
  page: 1,
  limit: 12,
  sort_by: 'createdAt',
  sort_order: 'desc' as const,
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readPage(value: unknown) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULTS.page
}

function readLimit(value: unknown) {
  const limit = Number(value)
  return Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : DEFAULTS.limit
}

export const Route = createFileRoute('/all-products')({
  validateSearch: (search: Record<string, unknown>): CatalogRouteSearch => ({
    q: readString(search.q),
    category: readString(search.category),
    gender: readString(search.gender),
    size: readString(search.size),
    color: readString(search.color),
    brand: readString(search.brand),
    minPrice: readString(search.minPrice),
    maxPrice: readString(search.maxPrice),
    sort_by: readString(search.sort_by) ?? DEFAULTS.sort_by,
    sort_order: search.sort_order === 'asc' || search.sort_order === 'desc' ? search.sort_order : DEFAULTS.sort_order,
    page: readPage(search.page),
    limit: readLimit(search.limit),
  }),
  component: AllProductsRoute,
})

function toSearchParams(search: CatalogRouteSearch): ProductListParams {
  return {
    q: search.q,
    category: search.category,
    gender: search.gender,
    size: search.size,
    color: search.color,
    brand: search.brand,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    sort_by: search.sort_by,
    sort_order: search.sort_order,
    page: search.page,
    limit: search.limit,
  }
}

function AllProductsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(search.q ?? '')

  useEffect(() => {
    setSearchInput(search.q ?? '')
  }, [search.q])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((search.q ?? '') === searchInput) return
      void navigate({
        search: (current) => ({
          ...current,
          q: searchInput.trim() || undefined,
          page: 1,
        }),
        replace: true,
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [navigate, search.q, searchInput])

  const params = useMemo(() => toSearchParams(search), [search])
  const productsQuery = useCatalogProductsQuery(params)
  const products = productsQuery.data?.data ?? []
  const total = productsQuery.data?.total ?? 0
  const totalPages = productsQuery.data?.totalPages ?? 1
  const page = params.page ?? 1
  const limit = params.limit ?? DEFAULTS.limit
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1
  const endItem = total === 0 ? 0 : Math.min(page * limit, total)

  const activeFilterCount = [
    search.category,
    search.gender,
    search.size,
    search.color,
    search.brand,
    search.minPrice,
    search.maxPrice,
    search.q,
  ].filter(Boolean).length

  const updateSearch = (next: Partial<CatalogRouteSearch>, replace = true) => {
    void navigate({
      search: (current) => ({
        ...current,
        ...next,
      }),
      replace,
    })
  }

  const handleClear = () => {
    updateSearch(
      {
        q: undefined,
        category: undefined,
        gender: undefined,
        size: undefined,
        color: undefined,
        brand: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        sort_by: DEFAULTS.sort_by,
        sort_order: DEFAULTS.sort_order,
        page: 1,
        limit: DEFAULTS.limit,
      },
      true,
    )
    setSearchInput('')
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-4">
          <p className="island-kicker m-0">Danh mục sản phẩm</p>
          <h1 className="display-title m-0 max-w-3xl text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
            Khám phá bộ sưu tập theo phong cách của bạn.
          </h1>
          <p className="m-0 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)] sm:text-lg">
            Tìm kiếm nhanh, lọc theo nhu cầu và mở trang chi tiết bằng prefetch nhẹ nhàng khi bạn có ý định xem sản phẩm.
          </p>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 shadow-sm">
              <label className="sr-only" htmlFor="catalog-search">
                Tìm kiếm sản phẩm
              </label>
              <input
                id="catalog-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm sản phẩm, thương hiệu, chất liệu..."
                className="w-full bg-transparent text-sm text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={[
                  ['createdAt', 'desc'],
                  ['createdAt', 'asc'],
                  ['price', 'asc'],
                  ['price', 'desc'],
                  ['name', 'asc'],
                  ['name', 'desc'],
                ].findIndex(([sortBy, sortOrder]) => sortBy === (params.sort_by ?? DEFAULTS.sort_by) && sortOrder === (params.sort_order ?? DEFAULTS.sort_order))}
                onChange={(event) => {
                  const options = [
                    { sort_by: 'createdAt', sort_order: 'desc' as const },
                    { sort_by: 'createdAt', sort_order: 'asc' as const },
                    { sort_by: 'price', sort_order: 'asc' as const },
                    { sort_by: 'price', sort_order: 'desc' as const },
                    { sort_by: 'name', sort_order: 'asc' as const },
                    { sort_by: 'name', sort_order: 'desc' as const },
                  ]
                  const option = options[Number(event.target.value)]
                  updateSearch({ sort_by: option.sort_by, sort_order: option.sort_order, page: 1 })
                }}
                className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--sea-ink)] shadow-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Sắp xếp sản phẩm"
              >
                <option value={0}>Mới nhất</option>
                <option value={1}>Cũ nhất</option>
                <option value={2}>Giá: Thấp → Cao</option>
                <option value={3}>Giá: Cao → Thấp</option>
                <option value={4}>Tên: A → Z</option>
                <option value={5}>Tên: Z → A</option>
              </select>

              <button
                type="button"
                className="lg:hidden rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)]"
                onClick={() => setMobileFiltersOpen((value) => !value)}
                aria-expanded={mobileFiltersOpen}
              >
                Lọc
              </button>
            </div>
          </div>

          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Hiển thị <span className="font-semibold text-[var(--sea-ink)]">{startItem}–{endItem}</span> trên{' '}
            <span className="font-semibold text-[var(--sea-ink)]">{total}</span> sản phẩm
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}>
          <CatalogFilters
            filters={{
              category: search.category,
              gender: search.gender,
              size: search.size,
              color: search.color,
              brand: search.brand,
              minPrice: search.minPrice,
              maxPrice: search.maxPrice,
            }}
            activeCount={activeFilterCount}
            onChange={(next) => updateSearch({ ...next, page: 1 })}
            onClear={handleClear}
          />
        </aside>

        <div className="space-y-6">
          {productsQuery.isError ? (
            <CatalogErrorState
              message={productsQuery.error instanceof Error ? productsQuery.error.message : 'Không thể tải danh sách sản phẩm.'}
              onRetry={() => void productsQuery.refetch()}
            />
          ) : productsQuery.isPending ? (
            <CatalogGridSkeleton />
          ) : products.length === 0 ? (
            <CatalogEmptyState
              title="Không tìm thấy sản phẩm"
              description="Thử xóa bộ lọc hoặc đổi từ khóa tìm kiếm để xem thêm kết quả."
              onClear={activeFilterCount > 0 || search.q ? handleClear : undefined}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => updateSearch({ page: page - 1 }, false)}
                    aria-label="Trang trước"
                  >
                    Trước
                  </button>
                  <span className="text-sm text-[var(--sea-ink-soft)]">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={page >= totalPages}
                    onClick={() => updateSearch({ page: page + 1 }, false)}
                    aria-label="Trang tiếp"
                  >
                    Sau
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
