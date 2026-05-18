import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  signIn,
  signUp,
  refreshToken,
  signOut,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  updateAddress,
  changePassword,
  verifyEmail,
  type LoginRequest,
  type SignupRequest,
  type UpdateProfileRequest,
  type UpdateAddressRequest,
  type ChangePasswordRequest,
  type VerifyEmailRequest,
  type UserResponse,
} from "../services/authApi";
import { useStore } from "../store";

// Query Key Factory

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

// Queries

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: getCurrentUser,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// Mutations

export function useSignIn() {
  const queryClient = useQueryClient();
  const setAuth = useStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: LoginRequest) => signIn(payload),
    onSuccess: (data) => {
      const user: UserResponse = {
        id: data.id,
        username: data.username,
        email: data.email,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        avatar: data.avatar,
        street: data.street,
        ward: data.ward,
        province: data.province,
        role: data.role,
      };
      setAuth(user, data.token);
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (payload: SignupRequest) => signUp(payload),
  });
}

export function useRefreshToken() {
  const queryClient = useQueryClient();
  const setUser = useStore((state) => state.setUser);

  return useMutation({
    mutationFn: () => refreshToken(),
    onSuccess: (data) => {
      const user: UserResponse = {
        id: data.id,
        username: data.username,
        email: data.email,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        avatar: data.avatar,
        street: data.street,
        ward: data.ward,
        province: data.province,
        role: data.role,
      };
      setUser(user);
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const logout = useStore((state) => state.logout);

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      logout();
      queryClient.invalidateQueries({ queryKey: authKeys.all });
      queryClient.removeQueries({ queryKey: authKeys.me() });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useStore((state) => state.setUser);

  return useMutation({
    mutationFn: (payload: UpdateProfileRequest) => updateProfile(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data);
      setUser(data);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) => changePassword(payload),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const setUser = useStore((state) => state.setUser);

  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data);
      setUser(data);
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  const setUser = useStore((state) => state.setUser);

  return useMutation({
    mutationFn: (payload: UpdateAddressRequest) => updateAddress(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data);
      setUser(data);
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (payload: VerifyEmailRequest) => verifyEmail(payload),
  });
}
