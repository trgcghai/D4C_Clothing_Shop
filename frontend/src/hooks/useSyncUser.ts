import { useEffect } from "react";
import { useStore } from "../store";
import { getCurrentUser } from "../services/authApi";

export function useSyncUser() {
  const { user, isAuthenticated, setUser } = useStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    getCurrentUser()
      .then((freshUser) => {
        setUser(freshUser);
      })
      .catch(() => {
        // silently fail — auth interceptor will handle expired tokens
      });
  }, []);
}
