import axiosInstance from "./_axios";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface StockEntry {
  size: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  gender: string;
  colors: string[];
  stock: StockEntry[];
  tags?: string[];
  isFeatured?: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilters {
  category?: string;
  gender?: string;
  size?: string;
  color?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface SearchResponse extends PaginatedResponse<Product> {
  query: string;
}

export interface ProductCreatePayload {
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  gender: string;
  colors: string[];
  stock: StockEntry[];
  tags?: string[];
  isFeatured?: boolean;
}

export interface ProductUpdatePayload extends Partial<ProductCreatePayload> {}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  message: string;
  error?: string;
}

// API Functions

/**
 * GET /api/products
 * Get a paginated list of products with optional filters.
 */
export const getProducts = async (
  params?: ProductFilters,
): Promise<PaginatedResponse<Product>> => {
  return axiosInstance.get("/api/products", { params }).then((res) => res.data);
};

/**
 * GET /api/products/featured
 * Get featured products.
 */
export const getFeaturedProducts = async (): Promise<Product[]> => {
  return axiosInstance.get("/api/products/featured").then((res) => res.data);
};

/**
 * GET /api/products/new-arrivals
 * Get new arrival products.
 */
export const getNewArrivals = async (limit = 8): Promise<Product[]> => {
  return axiosInstance
    .get("/api/products/new-arrivals", { params: { limit } })
    .then((res) => res.data);
};

/**
 * GET /api/products/search
 * Search products by keyword.
 */
export const searchProducts = async (
  query: string,
  options?: SearchOptions,
): Promise<SearchResponse> => {
  return axiosInstance
    .get("/api/products/search", { params: { q: query, ...options } })
    .then((res) => res.data);
};

/**
 * GET /api/products/:id
 * Get a single product by ID.
 */
export const getProductById = async (id: string): Promise<Product> => {
  return axiosInstance.get(`/api/products/${id}`).then((res) => res.data);
};

/**
 * GET /api/products/:id/related
 * Get related products by product ID.
 */
export const getRelatedProducts = async (id: string): Promise<Product[]> => {
  return axiosInstance
    .get(`/api/products/${id}/related`)
    .then((res) => res.data);
};

/**
 * POST /api/products
 * Create a new product (multipart/form-data for image upload).
 */
export const createProduct = async (
  payload: ProductCreatePayload,
  image?: File,
): Promise<Product> => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
    } else if (value) {
      formData.append(key, String(value));
    }
  });
  if (image) {
    formData.append("productImage", image);
  }

  return axiosInstance
    .post("/api/products", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};

/**
 * PUT /api/products/:id
 * Update an existing product (multipart/form-data for image upload).
 */
export const updateProduct = async (
  id: string,
  payload: ProductUpdatePayload,
  image?: File,
): Promise<Product> => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
    } else if (value) {
      formData.append(key, String(value));
    }
  });
  if (image) {
    formData.append("productImage", image);
  }

  return axiosInstance
    .put(`/api/products/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};

/**
 * DELETE /api/products/:id
 * Delete a product by ID.
 */
export const deleteProduct = async (id: string): Promise<DeleteResponse> => {
  return axiosInstance.delete(`/api/products/${id}`).then((res) => res.data);
};
