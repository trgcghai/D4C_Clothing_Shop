import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Product } from '@/features/catalog/api'

import { getTotalStock } from '../hooks'

interface AdminProductTableProps {
  readonly products: readonly Product[]
  readonly isLoading: boolean
  readonly isDeleting: boolean
  readonly onEdit: (product: Product) => void
  readonly onDelete: (product: Product) => void
}

export function AdminProductTable({
  products,
  isLoading,
  isDeleting,
  onEdit,
  onDelete,
}: AdminProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) {
      return products
    }

    return products.filter((product) => {
      const fields = [product.name, product.brand, product.category]
      return fields.some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
    })
  }, [normalizedQuery, products])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danh sách sản phẩm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tìm theo tên, brand, danh mục"
          aria-label="Tìm sản phẩm trong admin"
        />

        {isLoading ? (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Đang tải sản phẩm...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Không có sản phẩm phù hợp.</p>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{product.name}</p>
                  <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                    {product.category ?? 'N/A'} · {product.brand ?? 'N/A'} · {Number(product.price).toLocaleString('vi-VN')}₫ · Còn{' '}
                    {getTotalStock(product)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(product)}>
                    Sửa
                  </Button>
                  <Button type="button" size="sm" onClick={() => onDelete(product)} disabled={isDeleting}>
                    {isDeleting ? 'Đang xoá...' : 'Xoá'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
