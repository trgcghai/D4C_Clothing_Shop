import axiosInstance from "./_axios";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SearchProduct {
  id: string;
  name: string;
  description: string;
  category?: string;
  brand: string;
  gender: string;
  price: number;
  tags?: string[];
  imageUrl?: string;
  isFeatured?: boolean;
  createdAt: string;
  categoryId: string;
  updatedAt: string;
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
