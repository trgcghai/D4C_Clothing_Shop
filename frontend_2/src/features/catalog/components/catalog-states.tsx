import { PackageSearch, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CatalogEmptyStateProps {
  readonly title: string
  readonly description: string
  readonly onClear?: () => void
}

interface CatalogErrorStateProps {
  readonly message: string
  readonly onRetry: () => void
}

export function CatalogEmptyState({ title, description, onClear }: CatalogEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <PackageSearch className="size-14 text-[var(--sea-ink-soft)]/60" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">{title}</h2>
          <p className="m-0 max-w-md text-sm text-[var(--sea-ink-soft)]">{description}</p>
        </div>
        {onClear ? (
          <Button type="button" variant="outline" onClick={onClear}>
            Xóa bộ lọc
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function CatalogErrorState({ message, onRetry }: CatalogErrorStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <TriangleAlert className="size-14 text-rose-500" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">Không tải được sản phẩm</h2>
          <p className="m-0 max-w-md text-sm text-[var(--sea-ink-soft)]" role="alert" aria-live="polite">
            {message}
          </p>
        </div>
        <Button type="button" onClick={onRetry}>
          Thử lại
        </Button>
      </CardContent>
    </Card>
  )
}
