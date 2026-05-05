import http from "../lib/http";

const normalizeList = (payload) => {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      total: payload.length,
      totalPages: 1,
    };
  }

  const items = Array.isArray(payload?.data) ? payload.data : [];
  return {
    data: items,
    total: Number(payload?.total) || items.length,
    totalPages: Number(payload?.totalPages) || 1,
  };
};

export async function getProducts(params = {}) {
  const endpoint = params.q ? "/products/search" : "/products";
  const { data } = await http.get(endpoint, { params });
  return normalizeList(data);
}

export async function getProductById(id) {
  const { data } = await http.get(`/products/${id}`);
  return data;
}

export async function getRelatedProducts(id) {
  const { data } = await http.get(`/products/${id}/related`);
  return Array.isArray(data) ? data : [];
}

export async function createProduct(formData) {
  const { data } = await http.post("/products", formData);
  return data;
}

export async function updateProduct(id, formData) {
  const { data } = await http.put(`/products/${id}`, formData);
  return data;
}

export async function deleteProduct(id) {
  const { data } = await http.delete(`/products/${id}`);
  return data;
}
