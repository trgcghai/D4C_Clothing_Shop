import axiosInstance from "./_axios";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface Variant {
  id?: string;
  productId?: string;
  color: string;
  size: string;
  quantity: number;
  sku?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  category?: string;
  brand: string;
  gender: string;
  variants: Variant[];
  tags?: string[];
  isFeatured?: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilters {
  categoryId?: string;
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
  categoryId: string;
  brand: string;
  gender: string;
  variants: Variant[];
  tags?: string[];
  isFeatured?: boolean;
}

export interface ProductUpdatePayload extends Partial<ProductCreatePayload> {}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export interface DeductStockResponse {
  success: boolean;
  variantId: string;
  remaining: number;
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

/**
 * POST /api/products/variants/:variantId/deduct-stock
 * Atomically deduct stock from a variant.
 */
export const deductStock = async (
  variantId: string,
  quantity: number,
): Promise<DeductStockResponse> => {
  return axiosInstance
    .post(`/api/products/variants/${variantId}/deduct-stock`, { quantity })
    .then((res) => res.data);
};

export interface RestoreStockResponse {
  success: boolean;
  variantId: string;
  restored: number;
  current: number;
}

export const restoreStock = async (
  variantId: string,
  quantity: number,
): Promise<RestoreStockResponse> => {
  return axiosInstance
    .post(`/api/products/variants/${variantId}/restore-stock`, { quantity })
    .then((res) => res.data);
};

export interface ZipImportResponse {
  success: boolean;
  message: string;
  importedCount?: number;
  errors?: Array<{ row: number; field: string; message: string }>;
}

export const importProductsFromZip = async (
  zipFile: File,
): Promise<ZipImportResponse> => {
  const formData = new FormData();
  formData.append("zipFile", zipFile);

  return axiosInstance
    .post("/api/products/import-zip", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data)
    .catch((error) => {
      const status = error.response?.status;
      const data = error.response?.data;
      if (status === 400 && data) {
        return { success: false, message: data.message || "Import thất bại", errors: data.errors || [], importedCount: 0 };
      }
      if (status === 413 || status === 415) {
        return { success: false, message: data?.message || `Lỗi: ${status === 413 ? "File quá lớn" : "Sai định dạng file"}`, errors: [], importedCount: 0 };
      }
      throw error;
    });
};

// ─── Recommendation & Behavior ────────────────────────────────────────────────

export type BehaviorEventType =
  | "view"
  | "add_to_cart"
  | "buy_now"
  | "purchased";

/**
 * POST /api/recommendations/behaviors
 * Record a user behavior event for recommendation scoring.
 */
export const recordBehavior = async (
  userId: string,
  productId: string,
  eventType: BehaviorEventType,
): Promise<void> => {
  return axiosInstance
    .post("/api/recommendations/behaviors", { userId, productId, eventType })
    .then(() => undefined)
    .catch(() => undefined); // fire-and-forget, never block UI
};

/**
 * GET /api/recommendations?userId=&limit=
 * Get personalised product recommendations for a user.
 */
export const getRecommendations = async (
  userId: string,
  limit = 10,
): Promise<Product[]> => {
  return axiosInstance
    .get("/api/recommendations", { params: { userId, limit } })
    .then((res) => res.data)
    .catch(() => []); // fallback to empty list on error
};
