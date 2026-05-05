import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Product } from '@/features/catalog/api'

import { getTotalStock } from '../hooks'

interface AdminProductTableProps {
  readonly products: readonly Product[]
  readonly isLoading: boolean
  readonly isDeleting: boolean
  readonly onEdit: (product: Product) => void
  readonly onDelete: (product: Product) => void
}

export function AdminProductTable({ products, isLoading, isDeleting, onEdit, onDelete }: AdminProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) return products
    return products.filter((product) => {
      const fields = [product.name, product.brand, product.category]
      return fields.some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
    })
  }, [normalizedQuery, products])

  return (
    <Card>
      <CardHeader><CardTitle>Danh sách sản phẩm</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm theo tên, brand, danh mục" aria-label="Tìm sản phẩm trong admin" />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải sản phẩm...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có sản phẩm phù hợp.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead className="hidden md:table-cell">Danh mục</TableHead>
                <TableHead className="hidden lg:table-cell">Thương hiệu</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead className="hidden sm:table-cell">Tồn kho</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{product.category ?? 'N/A'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{product.brand ?? 'N/A'}</TableCell>
                  <TableCell>{Number(product.price).toLocaleString('vi-VN')}₫</TableCell>
                  <TableCell className="hidden sm:table-cell">{getTotalStock(product)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(product)}>Sửa</Button>
                      <Button type="button" size="sm" onClick={() => onDelete(product)} disabled={isDeleting}>{isDeleting ? 'Đang xoá...' : 'Xoá'}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
