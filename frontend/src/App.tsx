import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import AdminLayout from "./layouts/AdminLayout";

import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Signin from "./pages/Signin";
import VerifyEmail from "./pages/VerifyEmail";
import Profile from "./pages/Profile";
import ProductsPage from "./pages/ProductsPage";
import Admin from "./pages/Admin";
import ProductDetail from "./pages/ProductDetail";
import ProductManagement from "./pages/admin/ProductManagement";
import CategoryManagement from "./pages/admin/CategoryManagement";
import UserManagement from "./pages/admin/UserManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import CartPage from "./pages/CartPage";
import MyOrders from "./pages/MyOrders";
import OrderDetail from "./pages/OrderDetail";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentPage from "./pages/PaymentPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import { Toaster } from "@/components/ui/sonner";
import { useSyncUser } from "./hooks/useSyncUser";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/products", element: <ProductsPage /> },
      { path: "/products/:productId", element: <ProductDetail /> },
      { path: "/cart", element: <CartPage /> },
      { path: "/checkout", element: <CheckoutPage /> },
      { path: "/payment/:paymentId", element: <PaymentPage /> },
      { path: "/profile", element: <Profile /> },
      { path: "/orders", element: <MyOrders /> },
      { path: "/orders/:orderId", element: <OrderDetail /> },
      { path: "/recommendations", element: <RecommendationsPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/signin", element: <Signin /> },
      { path: "/signup", element: <Signup /> },
      { path: "/verify-email", element: <VerifyEmail /> },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: "/admin", element: <Admin /> },
      { path: "/admin/products", element: <ProductManagement /> },
      { path: "/admin/categories", element: <CategoryManagement /> },
      { path: "/admin/users", element: <UserManagement /> },
      { path: "/admin/orders", element: <OrderManagement /> },
    ],
  },
  {
    path: "*",
    element: <h1>Page Not Found</h1>,
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 2000),
      retryCondition: (error) => {
        if (!error.response) return true; // Network error
        return error.response.status >= 500;
      },
    },
  },
});

function App() {
  useSyncUser();

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
