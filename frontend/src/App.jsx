import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Navbar from "./components/navbar";
import Footer from "./components/footer";
import Home from "./pages/all-products"; // Using all-products as home for this microservice
import AllProducts from "./pages/all-products";
import Admin from "./pages/admin";
import AdminLogin from "./pages/adminLogin"; // Trang đăng nhập của Admin
import Product from "./pages/product"; // Trang chi tiết sản phẩm
import BackToTopButton from "./components/backToTopButton"
function App() {
  return (
    <>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/all-products" element={<AllProducts />} />
              {/* Thêm các route cho Admin */}
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
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
