import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function RequireAuth({ children }) {
  const { isAuthenticated, status } = useSelector((state) => state.auth);
  const location = useLocation();

  if (status === "loading") {
    return <div className="py-10 text-center">Loading account...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}

