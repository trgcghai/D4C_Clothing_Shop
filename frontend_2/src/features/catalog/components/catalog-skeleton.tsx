export function CatalogGridSkeleton({ count = 12 }: { readonly count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="island-shell animate-pulse overflow-hidden rounded-2xl">
          <div className="aspect-square bg-[rgba(79,184,178,0.12)]" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-20 rounded-full bg-[rgba(79,184,178,0.14)]" />
            <div className="h-5 w-4/5 rounded bg-[rgba(23,58,64,0.08)]" />
            <div className="h-3 w-3/5 rounded bg-[rgba(23,58,64,0.08)]" />
            <div className="flex gap-2 pt-1">
              <div className="h-3 w-3 rounded-full bg-[rgba(23,58,64,0.08)]" />
              <div className="h-3 w-3 rounded-full bg-[rgba(23,58,64,0.08)]" />
              <div className="h-3 w-3 rounded-full bg-[rgba(23,58,64,0.08)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="island-shell animate-pulse overflow-hidden rounded-3xl">
        <div className="aspect-square bg-[rgba(79,184,178,0.12)]" />
      </div>
      <div className="island-shell space-y-5 rounded-3xl p-6">
        <div className="h-3 w-28 rounded-full bg-[rgba(23,58,64,0.08)]" />
        <div className="h-10 w-4/5 rounded bg-[rgba(23,58,64,0.08)]" />
        <div className="h-8 w-40 rounded bg-[rgba(23,58,64,0.08)]" />
        <div className="h-20 rounded bg-[rgba(23,58,64,0.06)]" />
        <div className="h-12 rounded-xl bg-[rgba(23,58,64,0.08)]" />
      </div>
    </div>
  )
}
