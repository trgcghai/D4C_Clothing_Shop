import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { useStore } from "@/src/store";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Biến để track trạng thái refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, success: boolean = false) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(success);
    }
  });

  failedQueue = [];
};

// Request interceptor: gắn Bearer token từ store
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: tự động refresh khi 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isUnauthorized = error.response?.status === 401;
    const isRefreshEndpoint = originalRequest.url?.includes(
      "/api/auth/refresh-token",
    );

    // Nếu refresh token endpoint bị 401 → logout
    if (isUnauthorized && isRefreshEndpoint) {
      useStore.getState().logout();
      if (typeof window !== "undefined") {
        window.location.href = "/signin";
      }
      return Promise.reject(error);
    }

    // Kiểm tra message từ backend để xác định refresh token hết hạn
    const isRefreshTokenExpired =
      typeof error.response?.data === "object" &&
      error.response?.data !== null &&
      "message" in error.response.data &&
      (error.response.data as { message?: string }).message ===
        "Refresh token is invalid or expired";

    if (isUnauthorized && !originalRequest._retry && !isRefreshEndpoint) {
      if (isRefreshTokenExpired) {
        useStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/signin";
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosInstance(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const { refreshToken } = await import("./authApi");
        const data = await refreshToken();

        // Cập nhật token mới vào store
        useStore.getState().setAuth(
          {
            id: data.id,
            username: data.username,
            email: data.email,
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            avatar: data.avatar,
            role: data.role,
          },
          data.token,
        );

        processQueue(null, true);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, false);
        useStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/signin";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
