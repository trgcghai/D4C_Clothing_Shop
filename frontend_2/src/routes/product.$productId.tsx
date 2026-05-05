import { Link, createFileRoute } from '@tanstack/react-router'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { CatalogEmptyState, CatalogErrorState } from '@/features/catalog/components/catalog-states'
import { CatalogGridSkeleton, ProductDetailSkeleton } from '@/features/catalog/components/catalog-skeleton'
import { ProductCard } from '@/features/catalog/components/product-card'
import { useCatalogProductQuery, useCatalogRelatedProductsQuery } from '@/features/catalog/hooks'

const COLOR_MAP: Record<string, string> = {
  Đen: '#1a1a1a',
  Trắng: '#f5f5f5',
  Xám: '#9ca3af',
  Đỏ: '#ef4444',
  'Xanh Navy': '#1e3a5f',
  'Xanh Dương': '#3b82f6',
  'Xanh Lá': '#22c55e',
  Vàng: '#f59e0b',
  Hồng: '#ec4899',
  Nâu: '#92400e',
}

export const Route = createFileRoute('/product/$productId')({
  component: ProductDetailRoute,
})

function getStockCount(stock: readonly { size: string; quantity: number | string }[]) {
  return stock.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

function ProductDetailRoute() {
  const { productId } = Route.useParams()
  const productQuery = useCatalogProductQuery(productId)
  const relatedQuery = useCatalogRelatedProductsQuery(productId)
  const hasProduct = Boolean(productQuery.data)

  if (productQuery.isPending) {
    return (
      <main className="page-wrap px-4 py-10">
        <ProductDetailSkeleton />
      </main>
    )
  }

  if (productQuery.isError || !hasProduct) {
    return (
      <main className="page-wrap px-4 py-10">
        <CatalogErrorState
          message={productQuery.error instanceof Error ? productQuery.error.message : 'Sản phẩm không tồn tại.'}
          onRetry={() => void productQuery.refetch()}
        />
        <div className="mt-4 text-center">
          <Link to="/all-products" className="text-sm font-medium text-[var(--lagoon-deep)]">
            ← Quay lại danh sách sản phẩm
          </Link>
        </div>
      </main>
    )
  }

  const product = productQuery.data
  const stockCount = getStockCount(product.stock)
  const isOutOfStock = stockCount === 0
  const relatedProducts = relatedQuery.data ?? []

  return (
    <main className="page-wrap px-4 py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
        <Link to="/" className="hover:text-[var(--sea-ink)]">
          Trang chủ
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/all-products" className="hover:text-[var(--sea-ink)]">
          Sản phẩm
        </Link>
        {product.category ? (
          <>
            <span aria-hidden="true">/</span>
            <span>{product.category}</span>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="truncate font-medium text-[var(--sea-ink)]">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-square bg-[rgba(79,184,178,0.08)]">
            <img
              src={product.imageUrl || 'https://via.placeholder.com/1000x1000?text=Product'}
              alt={product.name}
              className="h-full w-full object-contain p-6"
            />
            {product.isFeatured ? (
              <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ⭐ Nổi bật
              </span>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            {product.brand ? <CardDescription className="uppercase tracking-[0.16em] text-[var(--kicker)]">{product.brand}</CardDescription> : null}
            <h1 className="display-title text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">{product.name}</h1>
            <p className="m-0 text-3xl font-extrabold text-[var(--lagoon-deep)]">
              {Number(product.price).toLocaleString('vi-VN')}₫
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2 text-sm">
              {product.category ? <span className="rounded-full bg-[rgba(79,184,178,0.12)] px-3 py-1 text-[var(--sea-ink)]">{product.category}</span> : null}
              {product.gender ? <span className="rounded-full bg-[rgba(47,106,74,0.1)] px-3 py-1 text-[var(--sea-ink)]">{product.gender}</span> : null}
              <span className={isOutOfStock ? 'rounded-full bg-rose-50 px-3 py-1 text-rose-700' : 'rounded-full bg-emerald-50 px-3 py-1 text-emerald-700'}>
                {isOutOfStock ? 'Hết hàng' : `Còn ${stockCount}`}
              </span>
            </div>

            {product.description ? <p className="m-0 text-sm leading-7 text-[var(--sea-ink-soft)]">{product.description}</p> : null}

            {product.colors?.length ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-[var(--sea-ink)]">Màu sắc</h2>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <span
                      key={color}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1 text-sm text-[var(--sea-ink)]"
                    >
                      <span className="size-3 rounded-full border border-white/70 ring-1 ring-black/10" style={{ backgroundColor: COLOR_MAP[color] || '#d1d5db' }} />
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {product.tags?.length ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-[var(--sea-ink)]">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[rgba(23,58,64,0.06)] px-3 py-1 text-xs text-[var(--sea-ink-soft)]">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <Link to="/all-products" className="inline-flex text-sm font-semibold text-[var(--lagoon-deep)]">
              ← Quay lại danh sách
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="mt-10 space-y-4">
        <div>
          <p className="island-kicker m-0 mb-2">Sản phẩm liên quan</p>
          <h2 className="m-0 text-2xl font-bold text-[var(--sea-ink)]">Bạn có thể thích</h2>
        </div>

        {relatedQuery.isError ? (
          <CatalogErrorState
            message={relatedQuery.error instanceof Error ? relatedQuery.error.message : 'Không tải được sản phẩm liên quan.'}
            onRetry={() => void relatedQuery.refetch()}
          />
        ) : relatedQuery.isPending ? (
          <CatalogGridSkeleton count={3} />
        ) : relatedProducts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {relatedProducts.map((related) => (
              <ProductCard key={related.id} product={related} compact />
            ))}
          </div>
        ) : (
          <CatalogEmptyState
            title="Chưa có sản phẩm liên quan"
            description="Danh mục này chưa có thêm mẫu nào để gợi ý."
          />
        )}
      </section>
    </main>
  )
}
