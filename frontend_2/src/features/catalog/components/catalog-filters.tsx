import { ChevronDown, ChevronUp, FilterX, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  { label: 'Tất cả', minPrice: '', maxPrice: '' },
  { label: 'Dưới 100.000₫', minPrice: '', maxPrice: '100000' },
  { label: '100.000 - 200.000₫', minPrice: '100000', maxPrice: '200000' },
  { label: '200.000 - 300.000₫', minPrice: '200000', maxPrice: '300000' },
  { label: '300.000 - 400.000₫', minPrice: '300000', maxPrice: '400000' },
  { label: 'Trên 400.000₫', minPrice: '400000', maxPrice: '' },
] as const

function FilterSection({ title, defaultOpen = true, children }: { readonly title: string; readonly defaultOpen?: boolean; readonly children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-border pb-4 last:border-b-0 last:pb-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between py-2 text-left text-sm font-semibold" aria-expanded={open}>
        <span>{title}</span>
        {open ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  )
}

export function CatalogFilters({ filters, activeCount, onChange, onClear }: CatalogFiltersProps) {
  const selectedPriceLabel = useMemo(() => PRICE_RANGES.find((r) => r.minPrice === (filters.minPrice ?? '') && r.maxPrice === (filters.maxPrice ?? ''))?.label ?? '', [filters.maxPrice, filters.minPrice])

  return (
    <Card className="sticky top-24">
      <CardHeader className="space-y-3 px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
            Bộ lọc
            {activeCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{activeCount}</span>}
          </CardTitle>
          {activeCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 text-xs">
              <FilterX className="size-3.5" aria-hidden="true" /> Xóa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <FilterSection title="Giới tính">
          <div className="space-y-2">
            {GENDERS.map((g) => (
              <div key={g} className="flex items-center space-x-2">
                <Checkbox id={`gender-${g}`} checked={filters.gender === g} onCheckedChange={(c) => onChange({ gender: c ? g : '' })} />
                <Label htmlFor={`gender-${g}`} className="text-sm font-normal cursor-pointer">{g}</Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Danh mục">
          <div className="space-y-2">
            {CATEGORIES.map((c) => (
              <div key={c} className="flex items-center space-x-2">
                <Checkbox id={`category-${c}`} checked={filters.category === c} onCheckedChange={(v) => onChange({ category: v ? c : '' })} />
                <Label htmlFor={`category-${c}`} className="text-sm font-normal cursor-pointer">{c}</Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Khoảng giá">
          <Select value={selectedPriceLabel || 'Tất cả'} onValueChange={(label) => { const r = PRICE_RANGES.find((p) => p.label === label); if (r) onChange({ minPrice: r.minPrice, maxPrice: r.maxPrice }) }}>
            <SelectTrigger><SelectValue placeholder="Chọn khoảng giá" /></SelectTrigger>
            <SelectContent>{PRICE_RANGES.map((r) => <SelectItem key={r.label} value={r.label}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </FilterSection>

        <FilterSection title="Thương hiệu" defaultOpen={false}>
          <div className="space-y-2">
            {BRANDS.map((b) => (
              <div key={b} className="flex items-center space-x-2">
                <Checkbox id={`brand-${b}`} checked={filters.brand === b} onCheckedChange={(v) => onChange({ brand: v ? b : '' })} />
                <Label htmlFor={`brand-${b}`} className="text-sm font-normal cursor-pointer">{b}</Label>
              </div>
            ))}
          </div>
        </FilterSection>
      </CardContent>
    </Card>
  )
}
