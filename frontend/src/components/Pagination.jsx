import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination component.
 * @param {{ page: number, totalPages: number, onPageChange: (p: number) => void }} props
 */
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i);
    }

    if (range[0] > 2) rangeWithDots.push(null); // "..."
    rangeWithDots.unshift(1);
    range.forEach((r) => rangeWithDots.push(r));
    if (range[range.length - 1] < totalPages - 1) rangeWithDots.push(null); // "..."
    if (totalPages > 1) rangeWithDots.push(totalPages);

    return rangeWithDots;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      {/* Previous */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300
                   disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="Trang trước"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === null ? (
          <span key={`dot-${i}`} className="px-2 text-gray-400 select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200
              ${p === page
                ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                : "border border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300"
              }`}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300
                   disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="Trang tiếp"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
