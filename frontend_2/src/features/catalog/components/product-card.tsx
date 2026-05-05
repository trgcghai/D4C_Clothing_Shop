import { Star, Tag } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { Product } from '../api'
import { usePrefetchCatalogProductDetail } from '../hooks'

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

interface ProductCardProps {
  readonly product: Product
  readonly compact?: boolean
}

function getStockCount(product: Product) {
  return product.stock.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const prefetchDetail = usePrefetchCatalogProductDetail()
  const stockCount = getStockCount(product)
  const isOutOfStock = stockCount === 0
  const colors = (product.colors ?? []).slice(0, 5)

  const createdAt = product.createdAt ? new Date(product.createdAt) : null
  const isNew = createdAt ? Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000 : false

  return (
    <Card className={cn('group overflow-hidden p-0 transition duration-200 hover:-translate-y-1 hover:shadow-lg', compact && 'rounded-2xl')}>
      <Link
        to="/product/$productId"
        params={{ productId: product.id }}
        preload="intent"
        onFocus={() => prefetchDetail(product.id)}
        onMouseEnter={() => prefetchDetail(product.id)}
        className="block no-underline"
      >
        <div className="relative aspect-square overflow-hidden bg-[rgba(79,184,178,0.08)]">
          <img
            src={product.imageUrl || 'https://via.placeholder.com/800x800?text=Product'}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {product.isFeatured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                <Star className="size-3" aria-hidden="true" />
                Nổi bật
              </span>
            ) : null}
            {isNew && !isOutOfStock ? (
              <span className="rounded-full bg-[var(--palm)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Mới
              </span>
            ) : null}
            {isOutOfStock ? (
              <span className="rounded-full bg-slate-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Hết hàng
              </span>
            ) : null}
          </div>
        </div>

        <CardContent className="space-y-2.5 p-4">
          {product.brand ? (
            <p className="m-0 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--kicker)]">
              <Tag className="size-3.5" aria-hidden="true" />
              {product.brand}
            </p>
          ) : null}

          <h3 className="m-0 line-clamp-2 text-sm font-semibold leading-snug text-[var(--sea-ink)] group-hover:text-[var(--lagoon-deep)]">
            {product.name}
          </h3>

          <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
            {[product.category, product.gender].filter(Boolean).join(' · ')}
          </p>

          {colors.length > 0 ? (
            <div className="flex items-center gap-1.5 pt-0.5" aria-label="Available colors">
              {colors.map((color) => (
                <span
                  key={color}
                  className="inline-block size-3.5 rounded-full border border-white/60 ring-1 ring-black/10"
                  style={{ backgroundColor: COLOR_MAP[color] || '#d1d5db' }}
                  title={color}
                />
              ))}
              {(product.colors?.length ?? 0) > colors.length ? (
                <span className="text-[10px] text-[var(--sea-ink-soft)]">+{(product.colors?.length ?? 0) - colors.length}</span>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="m-0 text-base font-extrabold text-[var(--lagoon-deep)]">
              {Number(product.price).toLocaleString('vi-VN')}₫
            </p>
            <span className={cn('text-xs font-medium', isOutOfStock ? 'text-rose-600' : 'text-emerald-700')}>
              {isOutOfStock ? 'Hết hàng' : `Còn ${stockCount}`}
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}
