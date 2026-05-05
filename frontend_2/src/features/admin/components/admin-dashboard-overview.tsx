import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Product } from '@/features/catalog/api'

import { getTotalStock } from '../hooks'

interface AdminDashboardOverviewProps {
  readonly products: readonly Product[]
}

export function AdminDashboardOverview({ products }: AdminDashboardOverviewProps) {
  const featuredProducts = products.filter((product) => product.isFeatured).length
  const lowStockProducts = products.filter((product) => {
    const totalStock = getTotalStock(product)
    return totalStock > 0 && totalStock <= 5
  }).length
  const outOfStockProducts = products.filter((product) => getTotalStock(product) === 0).length

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Tổng sản phẩm</CardDescription>
          <CardTitle className="text-2xl">{products.length}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Sản phẩm nổi bật</CardDescription>
          <CardTitle className="text-2xl">{featuredProducts}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Sắp hết hàng (≤ 5)</CardDescription>
          <CardTitle className="text-2xl">{lowStockProducts}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Hết hàng</CardDescription>
          <CardTitle className="text-2xl">{outOfStockProducts}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="sm:col-span-2 xl:col-span-4">
        <CardHeader>
          <CardTitle>Tổng quan</CardTitle>
          <CardDescription>
            Mọi thay đổi sản phẩm từ trang admin sẽ tự động làm mới dữ liệu catalog.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-[var(--sea-ink-soft)]">
          Tập trung ưu tiên xử lý sản phẩm hết hàng và nhóm sắp hết hàng để giảm tỷ lệ mất đơn.
        </CardContent>
      </Card>
    </div>
  )
}
