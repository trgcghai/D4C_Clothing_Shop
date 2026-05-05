import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { isAdminRole } from "../../lib/auth-role";

export default function RequireRole({ adminOnly = false, children }) {
  const role = useSelector((state) => state.auth.user?.role);

  if (adminOnly && !isAdminRole(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

