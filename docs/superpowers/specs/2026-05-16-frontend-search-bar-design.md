# Frontend Search Bar Integration — Design Spec

## Overview

Add a global search bar to the D4C Clothing Shop frontend navbar with instant dropdown suggestions and full search results via the existing products page. Leverages the backend Typesense SearchService for hybrid search (full-text + fuzzy + semantic).

## Architecture

| Component | File | Responsibility |
|---|---|---|
| SearchBar | `frontend/src/components/SearchBar.tsx` | Input, debounce, dropdown suggestions, navigation |
| AppLayout | `frontend/src/layouts/AppLayout.tsx` | Insert SearchBar into navbar |
| ProductsPage | `frontend/src/pages/ProductsPage.tsx` | Read `?search=` param, route to SearchService API, update heading |
| search.service | `frontend/src/services/search.service.ts` | API client for `/api/search` |

## Data Flow

```
User types in navbar → debounce 300ms → GET /api/search?q=keyword → dropdown (max 5)
User presses Enter or clicks suggestion → navigate /products?search=keyword
ProductsPage loads → reads ?search= param
  ├─ If search exists → GET /api/search?q=keyword (SearchService/Typesense)
  └─ If no search → GET /api/products (ProductService/DynamoDB)
→ Displays results with existing filters/pagination
```

## Component Details

### SearchBar.tsx
- Uses `useState` for input value, suggestions list, and open state
- Debounce via `setTimeout`/`clearTimeout` (300ms)
- Calls `searchService.searchProducts(query, { limit: 5 })` for suggestions
- Dropdown renders product name + price, max 5 items
- On Enter: `navigate(`/products?search=${encodeURIComponent(query)}`)`
- On suggestion click: same navigation
- Uses shadcn/ui `Input`, `Card`, `Button` components
- Responsive: `w-full md:w-80`

### AppLayout.tsx
- Import `SearchBar` component
- Insert `<SearchBar />` between `<nav>` and `<div className="flex items-center gap-2">`
- No other changes to layout structure

### ProductsPage.tsx
- Import `useSearchParams` from `react-router-dom`
- `const [searchParams] = useSearchParams()`
- `const searchQuery = searchParams.get("search")`
- Conditional API call:
  ```ts
  if (searchQuery) {
    // Use SearchService
    const result = await searchService.searchProducts(searchQuery, { page, limit, filter_by, sort_by });
  } else {
    // Use ProductService
    const result = await productService.getProducts({ page, limit, ...filters });
  }
  ```
- Dynamic heading:
  ```tsx
  <h1>{searchQuery ? `Kết quả tìm kiếm cho "${searchQuery}"` : "Tất cả sản phẩm"}</h1>
  ```

### search.service.ts
- New file in `frontend/src/services/`
- Uses existing `axios` instance from `services/api.ts` (or creates one with `VITE_API_BASE_URL`)
- `searchProducts(keyword: string, options?: SearchOptions): Promise<SearchResponse>`
- Matches existing response shape: `{ data, total, page, limit, totalPages, keyword, searchTimeMs }`

## API Contract

**Request:** `GET /api/search?q=keyword&page=1&limit=12&filter_by=brand:D4C`

**Response:**
```json
{
  "data": [{"id": "...", "name": "...", "price": 250000, "imageUrl": "...", ...}],
  "total": 42,
  "page": 1,
  "limit": 12,
  "totalPages": 4,
  "keyword": "keyword",
  "searchTimeMs": 23
}
```

## Error Handling

| Scenario | Behavior |
|---|---|
| SearchService unavailable | Show toast "Dịch vụ tìm kiếm tạm thời không khả dụng", fall back to empty state |
| Empty search results | Show "Không tìm thấy sản phẩm nào cho '<keyword>'" with link to browse all products |
| Network error | Show generic error toast, retry option |

## Styling

- Follow existing shadcn/ui + Tailwind conventions
- SearchBar: `bg-background border rounded-md` matching navbar style
- Dropdown: absolute positioned below input, `z-50`, shadow, rounded
- Active suggestion: `bg-muted` hover state
- Consistent with existing `ProductCard` and `CustomPagination` styling
