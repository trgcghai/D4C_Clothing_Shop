import { Search, X } from "lucide-react";

/**
 * SearchBar component with debounced input and clear button.
 * @param {{ value: string, onChange: (v: string) => void, placeholder?: string, loading?: boolean }} props
 */
export default function SearchBar({ value, onChange, placeholder = "Tìm kiếm sản phẩm...", loading = false }) {
  return (
    <div className="relative flex-1 max-w-xl">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        {loading ? (
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Search className="w-4 h-4 text-gray-400" />
        )}
      </div>

      <input
        id="product-search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm
                   focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent
                   transition-all duration-200 shadow-sm"
      />

      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Xóa tìm kiếm"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
