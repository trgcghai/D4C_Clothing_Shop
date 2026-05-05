import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";

import Navbar from "./components/navbar";
import Footer from "./components/footer";
import Home from "./pages/all-products"; // Using all-products as home for this microservice
import AllProducts from "./pages/all-products";
import Admin from "./pages/admin";
import AdminLogin from "./pages/adminLogin"; // Trang đăng nhập của Admin
import Product from "./pages/product"; // Trang chi tiết sản phẩm
import BackToTopButton from "./components/backToTopButton";
import SignIn from "./pages/signin";
import SignUp from "./pages/signup";
import Profile from "./pages/profile";
import RequireAuth from "./components/auth/RequireAuth";
import RequireRole from "./components/auth/RequireRole";
import { configureHttpAuth } from "./lib/http";
import { refreshToken } from "./api/auth";
import { logout, setAuthStatus, setToken, setUser } from "./store/authSlice";
import { authQueryKeys, useAuthBootstrapQuery } from "./hooks/useAuth";

function App() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const queryClient = useQueryClient();
  const meQuery = useAuthBootstrapQuery(accessToken);

  useEffect(() => {
    configureHttpAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: refreshToken,
      onTokenUpdated: (nextToken) => {
        dispatch(setToken(nextToken));
        queryClient.invalidateQueries({ queryKey: authQueryKeys.me() });
      },
      onAuthFailed: () => {
        dispatch(logout());
        queryClient.removeQueries({ queryKey: authQueryKeys.all });
        window.location.assign("/signin");
      },
    });
  }, [accessToken, dispatch, queryClient]);

  useEffect(() => {
    if (!accessToken) {
      dispatch(setAuthStatus("unauthenticated"));
      dispatch(setUser(null));
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
      return;
    }

    if (meQuery.isPending) {
      dispatch(setAuthStatus("loading"));
      return;
    }

    if (meQuery.isSuccess) {
      dispatch(setUser(meQuery.data));
      return;
    }

    if (meQuery.isError) {
      dispatch(logout());
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
    }
  }, [accessToken, dispatch, meQuery.data, meQuery.isError, meQuery.isPending, meQuery.isSuccess, queryClient]);

  return (
    <>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/all-products" element={<AllProducts />} />
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <RequireRole adminOnly>
                      <Admin />
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />
              <Route path="/product/:productId" element={<Product />} />
            </Routes>
          </main>
          <Footer />
          <BackToTopButton />
        </div>
      </Router>
      <ToastContainer position="top-right" autoClose={1500} hideProgressBar={false} />
    </>
  );
}

export default App;
