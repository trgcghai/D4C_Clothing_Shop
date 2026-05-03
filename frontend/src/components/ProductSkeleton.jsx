/**
 * Product card skeleton for loading state
 */
export default function ProductSkeleton({ count = 12 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-white shadow-sm animate-pulse">
          {/* Image area */}
          <div className="aspect-square bg-gray-200" />
          {/* Info area */}
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-5 bg-gray-200 rounded w-1/3 mt-1" />
            {/* Color dots */}
            <div className="flex gap-1 pt-1">
              {[1, 2, 3].map((d) => (
                <div key={d} className="w-4 h-4 rounded-full bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
