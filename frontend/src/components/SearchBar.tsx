import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { searchProducts, type SearchProduct } from "@/src/services/searchApi";
import { formatCurrency } from "@/src/lib/currencyFormatter";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchProduct[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await searchProducts(searchQuery, { limit: 5 });
      setSuggestions(result.data);
      setIsOpen(result.data.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (product: SearchProduct) => {
    navigate(`/products/${product.id}`);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full md:w-80">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Tìm kiếm sản phẩm..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </form>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
          <ul className="max-h-80 overflow-auto py-1">
            {suggestions.map((product, index) => (
              <li key={product.id}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                    index === activeIndex
                      ? "bg-muted"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSuggestionClick(product)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md p-3 text-center text-sm text-muted-foreground">
          Đang tìm...
        </div>
      )}
    </div>
  );
}
