import axiosInstance from "./_axios";

export interface Category {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CategoryCreatePayload {
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface CategoryUpdatePayload extends Partial<CategoryCreatePayload> {}

export const getCategories = async (): Promise<Category[]> => {
  return axiosInstance.get("/api/categories").then((res) => res.data);
};

export const getCategoryById = async (id: string): Promise<Category> => {
  return axiosInstance.get(`/api/categories/${id}`).then((res) => res.data);
};

export const createCategory = async (payload: CategoryCreatePayload, image?: File): Promise<Category> => {
  const formData = new FormData();
  formData.append("name", payload.name);
  if (payload.description) formData.append("description", payload.description);
  if (payload.imageUrl) formData.append("imageUrl", payload.imageUrl);
  if (image) formData.append("categoryImage", image);

  return axiosInstance.post("/api/categories", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data);
};

export const updateCategory = async (id: string, payload: CategoryUpdatePayload, image?: File): Promise<Category> => {
  const formData = new FormData();
  if (payload.name) formData.append("name", payload.name);
  if (payload.description !== undefined) formData.append("description", payload.description);
  if (payload.imageUrl !== undefined) formData.append("imageUrl", payload.imageUrl);
  if (image) formData.append("categoryImage", image);

  return axiosInstance.put(`/api/categories/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data);
};

export const deleteCategory = async (id: string): Promise<{ success: boolean; message: string }> => {
  return axiosInstance.delete(`/api/categories/${id}`).then((res) => res.data);
};
