import axiosInstance from "./_axios";
import { Role } from "./authApi";

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  enabled: boolean;
  avatar?: string;
}

export interface PaginatedUsersResponse {
  data: UserSummary[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface UserFilters {
  q?: string;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface ToggleStatusResponse {
  success: boolean;
  enabled: boolean;
}

/**
 * GET /api/admin/users
 * Get a paginated list of users with optional search.
 */
export const getUsers = async (
  params?: UserFilters,
): Promise<PaginatedUsersResponse> => {
  return axiosInstance.get("/api/admin/users", { params }).then((res) => res.data);
};

/**
 * PATCH /api/admin/users/{userId}/toggle-status
 * Toggle a user's enabled status.
 */
export const toggleUserStatus = async (
  userId: number,
): Promise<ToggleStatusResponse> => {
  return axiosInstance
    .patch(`/api/admin/users/${userId}/toggle-status`)
    .then((res) => res.data);
};
