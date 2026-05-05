import axios from "axios";
import { extractAccessToken } from "./auth-contract";

const baseURL = import.meta.env.VITE_API_URL;

let http;
let isAuthConfigured = false;
let getAccessToken = () => null;
let onAuthFailed = () => {};
let refreshAccessToken = null;
let onTokenUpdated = () => {};

try {
  if (!baseURL) {
    throw new Error(
      "API base URL is not defined. Please set VITE_API_URL in your environment variables.",
    );
  }

  http = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      Accept: "application/json",
    },
  });
} catch (error) {
  console.error("Failed to create HTTP client:", error);
}

export function configureHttpAuth(options) {
  getAccessToken = options?.getAccessToken || (() => null);
  refreshAccessToken = options?.refreshAccessToken || null;
  onAuthFailed = options?.onAuthFailed || (() => {});
  onTokenUpdated = options?.onTokenUpdated || (() => {});

  if (isAuthConfigured || !http) return;
  isAuthConfigured = true;

  http.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  http.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error?.config;
      const status = error?.response?.status;
      const url = originalRequest?.url || "";
      const isRefreshCall = url.includes("/api/auth/refresh-token");
      const isAuthFormCall = url.includes("/api/auth/signin") || url.includes("/api/auth/signup");

      if (
        status === 401 &&
        !originalRequest?._retry &&
        !isRefreshCall &&
        !isAuthFormCall &&
        typeof refreshAccessToken === "function"
      ) {
        originalRequest._retry = true;
        try {
          const refreshPayload = await refreshAccessToken();
          const nextToken = extractAccessToken(refreshPayload);

          if (!nextToken) {
            throw new Error("Access token is missing in refresh response");
          }

          onTokenUpdated(nextToken);
          originalRequest.headers.Authorization = `Bearer ${nextToken}`;
          return http(originalRequest);
        } catch (refreshError) {
          onAuthFailed(refreshError);
          return Promise.reject(refreshError);
        }
      }

      if (status === 401 && isRefreshCall) {
        onAuthFailed(error);
      }

      return Promise.reject(error);
    },
  );
}

export default http;
