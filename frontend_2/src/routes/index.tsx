import { Link, createFileRoute } from '@tanstack/react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: HomeRoute,
})

function HomeRoute() {
  return (
    <main className="page-wrap px-4 pb-10 pt-12">
      <section className="island-shell relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.34),transparent_68%)]" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_68%)]" />
        <p className="island-kicker mb-3">D4C Clothing Shop</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          Bắt đầu từ danh mục, chạm đến từng chi tiết.
        </h1>
        <p className="mb-8 max-w-2xl text-base leading-8 text-[var(--sea-ink-soft)] sm:text-lg">
          Khám phá bộ sưu tập, lọc theo nhu cầu và xem trước sản phẩm bằng prefetch nhẹ nhàng khi bạn có ý định mở trang chi tiết.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/all-products"
            className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--lagoon-deep)] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Xem tất cả sản phẩm
          </Link>
          <Link
            to="/all-products"
            search={{ sort_by: 'createdAt', sort_order: 'desc', page: 1, limit: 12 }}
            className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 text-sm font-medium text-[var(--sea-ink)] shadow-sm transition hover:bg-[var(--link-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Mới nhất
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Bộ lọc nhanh', 'Duyệt theo danh mục, giới tính, thương hiệu và khoảng giá.'],
          ['Mở chi tiết mượt', 'Prefetch khi bạn hover hoặc focus vào sản phẩm.'],
          ['Trải nghiệm quen thuộc', 'Giữ vibe thẩm mỹ gần với frontend cũ nhưng sạch hơn.'],
          ['Đi thẳng vào shop', 'Trang chủ đóng vai trò cửa vào danh mục sản phẩm.'],
        ].map(([title, description]) => (
          <Card key={title} className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-[var(--sea-ink-soft)]">
              <Link to="/all-products" className="font-medium text-[var(--lagoon-deep)]">
                Khám phá ngay →
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
