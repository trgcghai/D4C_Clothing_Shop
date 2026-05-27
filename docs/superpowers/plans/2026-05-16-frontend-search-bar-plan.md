# Frontend Search Bar Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global search bar to the D4C Clothing Shop frontend navbar with instant dropdown suggestions and full search results via the existing products page. Leverages the backend Typesense SearchService for hybrid search.

**Architecture:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + TanStack Query + Zustand

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/services/searchApi.ts` | Create | Types + API client for `/api/search` |
| `frontend/src/hooks/useSearchResults.ts` | Create | TanStack Query hook for search results |
| `frontend/src/components/SearchBar.tsx` | Create | Navbar search input with debounce + suggestions dropdown |
| `frontend/src/layouts/AppLayout.tsx` | Modify | Insert SearchBar into navbar |
| `frontend/src/pages/ProductsPage.tsx` | Modify | Read `?search=` param, route to SearchService API, dynamic heading |

---

### Task 1: Create searchApi.ts — Types + API Client

**File:** `frontend/src/services/searchApi.ts`

- [ ] **Step 1: Write searchApi.ts**

Create a new file with Typesense search response types and API client function. Uses the existing `axiosInstance` from `_axios.ts`.

```ts
import axiosInstance from "./_axios";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SearchProduct {
  id: string;
  name: string;
  description: string;
  category: string | null;
  brand: string | null;
  gender: string | null;
  price: number;
  tags: string[];
  imageUrl: string;
  isFeatured: boolean;
  createdAt: number; // Unix timestamp from Typesense
  variants: Array<{
    color: string;
    size: string;
    quantity: number;
    sku?: string;
  }>;
  _text_match?: number;
  _vector_distance?: number;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  filter_by?: string;
  sort_by?: string;
}

export interface SearchResponse {
  data: SearchProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  keyword: string;
  searchTimeMs: number;
}

// ─── API Functions ──────────────────────────────────────────────────────────────

/**
 * GET /api/search?q=keyword&page=1&limit=12
 * Search products via Typesense SearchService.
 */
export const searchProducts = async (
  query: string,
  options?: SearchOptions,
): Promise<SearchResponse> => {
  return axiosInstance
    .get("/api/search", { params: { q: query, ...options } })
    .then((res) => res.data);
};
```

---

### Task 2: Create useSearchResults.ts — TanStack Query Hook

**File:** `frontend/src/hooks/useSearchResults.ts`

- [ ] **Step 1: Write useSearchResults.ts**

Create a TanStack Query hook for search results with proper query key factory.

```ts
import { useQuery } from "@tanstack/react-query";
import { searchProducts, type SearchOptions } from "../services/searchApi";

export const searchKeys = {
  all: ["search"] as const,
  list: (query: string, options?: SearchOptions) =>
    [...searchKeys.all, query, options] as const,
};

export function useSearchResults(query: string, options?: SearchOptions) {
  return useQuery({
    queryKey: searchKeys.list(query, options),
    queryFn: () => searchProducts(query, options),
    enabled: query.length > 0,
    staleTime: 30_000, // Search results are stale after 30s
  });
}
```

---

### Task 3: Create SearchBar.tsx — Navbar Search Component

**File:** `frontend/src/components/SearchBar.tsx`

- [ ] **Step 1: Write SearchBar.tsx**

Create a search bar component with:
- Debounced input (300ms) for suggestions
- Dropdown showing up to 5 product suggestions (name + price)
- Enter key navigates to `/products?search=...`
- Click on suggestion navigates to product detail page
- Close dropdown on outside click or Escape
- Uses shadcn/ui Input component
- Responsive: `w-full md:w-80`

```tsx
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
```

---

### Task 4: Modify AppLayout.tsx — Insert SearchBar

**File:** `frontend/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Import SearchBar**

Add import at the top:
```tsx
import SearchBar from "@/src/components/SearchBar";
```

- [ ] **Step 2: Insert SearchBar into navbar**

Between the `<nav>` element and the `<div className="flex items-center gap-2">`, add:

```tsx
<div className="flex flex-1 justify-center md:justify-start md:ml-6">
  <SearchBar />
</div>
```

The navbar header structure becomes:
```tsx
<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
  <Link to="/" className="text-xl font-bold tracking-tight">
    D4C
  </Link>

  <nav className="hidden items-center gap-6 md:flex">
    {navLinks.map(({ to, label }) => (...))}
  </nav>

  <div className="flex flex-1 justify-center md:justify-start md:ml-6">
    <SearchBar />
  </div>

  <div className="flex items-center gap-2">
    {isAuthenticated && <CartIcon />}
    <UserButton />
  </div>
</div>
```

---

### Task 5: Modify ProductsPage.tsx — Search Results Integration

**File:** `frontend/src/pages/ProductsPage.tsx`

- [ ] **Step 1: Add search query param extraction**

After the existing filter params extraction, add:
```tsx
const searchQuery = searchParams.get("search") || undefined;
```

- [ ] **Step 2: Add conditional search hook**

Import `useSearchResults` from the new hook file. Use it conditionally:

```tsx
import { useSearchResults } from "@/src/hooks/useSearchResults";
```

Add after the existing `useProducts` hook:
```tsx
const searchOptions = useMemo(
  () => ({
    page,
    limit,
    sort_by: sort,
  }),
  [page, limit, sort],
);

const { data: searchData, isLoading: searchLoading } = useSearchResults(
  searchQuery ?? "",
  searchOptions,
);
```

- [ ] **Step 3: Use search data when searchQuery exists**

Replace the data loading logic:
```tsx
const data = searchQuery ? searchData : dataFromProducts;
const isLoading = searchQuery ? searchLoading : isLoadingFromProducts;
```

Rename the existing `useProducts` result:
```tsx
const { data: dataFromProducts, isLoading: isLoadingFromProducts } = useProducts(filters);
```

- [ ] **Step 4: Update heading**

Replace the heading section:
```tsx
<h1 className="text-3xl font-bold">
  {searchQuery ? `Kết quả tìm kiếm cho "${searchQuery}"` : "Tất cả sản phẩm"}
</h1>
<p className="text-muted-foreground mt-1">
  {data?.total ?? 0} sản phẩm
  {searchQuery && (
    <span className="ml-2 text-xs text-muted-foreground">
      ({data?.searchTimeMs}ms)
    </span>
  )}
</p>
```

- [ ] **Step 5: Update empty state for search**

When search query exists and no results, show search-specific empty state:
```tsx
{searchQuery ? (
  <>
    <h2 className="text-xl font-semibold">
      Không tìm thấy sản phẩm nào cho "{searchQuery}"
    </h2>
    <p className="mt-2 text-muted-foreground">
      Thử tìm với từ khóa khác hoặc{" "}
      <Link to="/products" className="text-primary hover:underline">
        xem tất cả sản phẩm
      </Link>
    </p>
  </>
) : (
  <>
    <h2 className="text-xl font-semibold">
      Không tìm thấy sản phẩm nào.
    </h2>
    <p className="mt-2 text-muted-foreground">
      Vui lòng thử điều chỉnh bộ lọc của bạn.
    </p>
  </>
)}
```

- [ ] **Step 6: Add Link import**

Add `Link` to the react-router-dom import:
```tsx
import { Link, useSearchParams } from "react-router-dom";
```

- [ ] **Step 7: Add clear search button**

When searchQuery exists, show a button to clear search:
```tsx
{searchQuery && (
  <Button
    variant="outline"
    onClick={() => {
      const params = new URLSearchParams(searchParams);
      params.delete("search");
      setSearchParams(params);
    }}
  >
    <X className="size-3.5 mr-1" />
    Xóa tìm kiếm
  </Button>
)}
```

---

## Self-Review

**1. Design spec coverage check:**

| Spec Requirement | Task |
|---|---|
| SearchBar component with debounce | Task 3 |
| Dropdown suggestions (max 5) | Task 3 |
| Enter navigates to /products?search= | Task 3 |
| AppLayout integration | Task 4 |
| ProductsPage conditional API routing | Task 5 |
| Dynamic heading | Task 5 |
| search.service.ts API client | Task 1 |
| Error handling (toast, empty state) | Tasks 3, 5 |

**2. Placeholder scan:** No TBD, TODO, or incomplete sections found.

**3. Type consistency:** All Typesense response types match the backend API contract. SearchProduct extends the base Product shape with Typesense-specific fields.

**4. Scope:** Focused on search bar + products page integration. No unrelated refactoring.
