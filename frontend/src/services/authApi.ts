import axiosInstance from "./_axios";

// ─── Types ──────────────────────────────────────────────────────────────────────

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  password: string;
  role?: Role;
}

export interface JwtResponse {
  token: string;
  type: string;
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  avatar: string;
  street?: string;
  ward?: string;
  province?: string;
  role: Role;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  avatar: string;
  street?: string;
  ward?: string;
  province?: string;
  role: Role;
}

export interface UpdateProfileRequest {
  fullName?: string;
  phoneNumber?: string;
  avatar?: string;
}

export interface UpdateAddressRequest {
  street?: string;
  ward?: string;
  province?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  email: string;
  verificationCode: string;
}

export interface ErrorResponse {
  message: string;
}

// ─── API Functions ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signin
 * Authenticate user and return access token.
 */
export const signIn = async (payload: LoginRequest): Promise<JwtResponse> => {
  return axiosInstance
    .post("/api/auth/signin", payload)
    .then((res) => res.data);
};

/**
 * POST /api/auth/signup
 * Register a new account.
 */
export const signUp = async (
  payload: SignupRequest,
): Promise<ErrorResponse> => {
  return axiosInstance
    .post("/api/auth/signup", payload)
    .then((res) => res.data);
};

/**
 * POST /api/auth/refresh-token
 * Refresh access token using refresh token cookie.
 */
export const refreshToken = async (): Promise<JwtResponse> => {
  return axiosInstance.post("/api/auth/refresh-token").then((res) => res.data);
};

/**
 * POST /api/auth/signout
 * Clear refresh token and sign out.
 */
export const signOut = async (): Promise<ErrorResponse> => {
  return axiosInstance.post("/api/auth/signout").then((res) => res.data);
};

/**
 * GET /api/users/me
 * Get current authenticated user's profile.
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
  return axiosInstance.get("/api/users/me").then((res) => res.data);
};

/**
 * PUT /api/users/me
 * Update current user's profile.
 */
export const updateProfile = async (
  payload: UpdateProfileRequest,
): Promise<UserResponse> => {
  return axiosInstance.put("/api/users/me", payload).then((res) => res.data);
};

/**
 * POST /api/auth/verify-email
 * Verify user email with 6-digit code.
 */
export const verifyEmail = async (
  payload: VerifyEmailRequest,
): Promise<{ message: string }> => {
  return axiosInstance
    .post("/api/auth/verify-email", payload)
    .then((res) => res.data);
};

/**
 * PUT /api/users/me/password
 * Change current user's password.
 */
export const changePassword = async (
  payload: ChangePasswordRequest,
): Promise<ErrorResponse> => {
  return axiosInstance
    .put("/api/users/me/password", payload)
    .then((res) => res.data);
};

/**
 * POST /api/users/me/avatar
 * Upload avatar image via multipart form data.
 */
export const uploadAvatar = async (file: File): Promise<UserResponse> => {
  const formData = new FormData();
  formData.append("avatar", file);
  return axiosInstance
    .post("/api/users/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};

/**
 * PUT /api/users/me/address
 * Update current user's address.
 */
export const updateAddress = async (
  payload: UpdateAddressRequest,
): Promise<UserResponse> => {
  return axiosInstance
    .put("/api/users/me/address", payload)
    .then((res) => res.data);
};
