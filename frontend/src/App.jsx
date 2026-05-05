import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

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
import { extractAccessToken } from "./lib/auth-contract";
import { normalizeRole } from "./lib/auth-role";
import { refreshToken } from "./api/auth";
import { getMe } from "./api/users";
import { logout, setAuthStatus, setToken, setUser } from "./store/authSlice";

function App() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);

  useEffect(() => {
    configureHttpAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: refreshToken,
      onTokenUpdated: (nextToken) => {
        dispatch(setToken(nextToken));
      },
      onAuthFailed: () => {
        dispatch(logout());
        window.location.assign("/signin");
      },
    });
  }, [accessToken, dispatch]);

  useEffect(() => {
    async function bootstrapAuth() {
      if (!accessToken) {
        dispatch(setAuthStatus("unauthenticated"));
        dispatch(setUser(null));
        return;
      }

      dispatch(setAuthStatus("loading"));
      try {
        const me = await getMe();
        dispatch(setUser({ ...me, role: normalizeRole(me?.role) }));
      } catch {
        try {
          const refreshed = await refreshToken();
          const nextToken = extractAccessToken(refreshed);
          if (!nextToken) throw new Error("Missing refreshed access token");
          dispatch(setToken(nextToken));
          const me = await getMe();
          dispatch(setUser({ ...me, role: normalizeRole(me?.role) }));
        } catch {
          dispatch(logout());
        }
      }
    }

    bootstrapAuth();
  }, [accessToken, dispatch]);

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
