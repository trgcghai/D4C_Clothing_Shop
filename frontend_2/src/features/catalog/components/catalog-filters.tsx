import { ChevronDown, ChevronUp, FilterX, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { ProductListParams } from '../api'

interface CatalogFiltersProps {
  readonly filters: Pick<ProductListParams, 'category' | 'gender' | 'size' | 'color' | 'brand' | 'minPrice' | 'maxPrice'>
  readonly activeCount: number
  readonly onChange: (next: Partial<ProductListParams>) => void
  readonly onClear: () => void
}

const GENDERS = ['Nam', 'Nữ', 'Unisex'] as const
const CATEGORIES = ['Áo', 'Quần', 'Giày', 'Phụ kiện'] as const
const BRANDS = ['D4C', 'Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'Local Brand'] as const
const PRICE_RANGES = [
  { label: 'Dưới 100.000₫', minPrice: '', maxPrice: '100000' },
  { label: '100.000 - 200.000₫', minPrice: '100000', maxPrice: '200000' },
  { label: '200.000 - 300.000₫', minPrice: '200000', maxPrice: '300000' },
  { label: '300.000 - 400.000₫', minPrice: '300000', maxPrice: '400000' },
  { label: 'Trên 400.000₫', minPrice: '400000', maxPrice: '' },
] as const

function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  readonly title: string
  readonly defaultOpen?: boolean
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-2 text-left text-sm font-semibold text-[var(--sea-ink)]"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
      </button>
      {open ? <div className="mt-2 space-y-2">{children}</div> : null}
    </section>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  readonly label: string
  readonly active: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-transparent bg-[var(--lagoon-deep)] text-white shadow-sm'
          : 'border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]',
      )}
    >
      {label}
    </button>
  )
}

export function CatalogFilters({ filters, activeCount, onChange, onClear }: CatalogFiltersProps) {
  const selectedPriceLabel = useMemo(
    () => PRICE_RANGES.find((range) => range.minPrice === (filters.minPrice ?? '') && range.maxPrice === (filters.maxPrice ?? ''))?.label ?? '',
    [filters.maxPrice, filters.minPrice],
  )

  return (
    <Card className="sticky top-24">
      <CardHeader className="space-y-3 px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-[var(--lagoon-deep)]" aria-hidden="true" />
            Bộ lọc
            {activeCount > 0 ? (
              <span className="rounded-full bg-[var(--lagoon-deep)] px-2 py-0.5 text-xs text-white">{activeCount}</span>
            ) : null}
          </CardTitle>
          {activeCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 text-xs">
              <FilterX className="size-3.5" aria-hidden="true" />
              Xóa
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <FilterSection title="Giới tính">
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((gender) => (
              <FilterChip
                key={gender}
                label={gender}
                active={filters.gender === gender}
                onClick={() => onChange({ gender: filters.gender === gender ? '' : gender })}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Danh mục">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <FilterChip
                key={category}
                label={category}
                active={filters.category === category}
                onClick={() => onChange({ category: filters.category === category ? '' : category })}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Khoảng giá">
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((range) => (
              <FilterChip
                key={range.label}
                label={range.label}
                active={selectedPriceLabel === range.label}
                onClick={() =>
                  selectedPriceLabel === range.label
                    ? onChange({ minPrice: '', maxPrice: '' })
                    : onChange({ minPrice: range.minPrice, maxPrice: range.maxPrice })
                }
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Thương hiệu" defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {BRANDS.map((brand) => (
              <FilterChip
                key={brand}
                label={brand}
                active={filters.brand === brand}
                onClick={() => onChange({ brand: filters.brand === brand ? '' : brand })}
              />
            ))}
          </div>
        </FilterSection>
      </CardContent>
    </Card>
  )
}
