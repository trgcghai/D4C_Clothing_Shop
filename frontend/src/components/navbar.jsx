"use client";

import { Link, useNavigate } from "react-router-dom";
import { Search, Menu } from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "../api/auth";
import { logout } from "../store/authSlice";
import { isAdminRole } from "../lib/auth-role";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Xử lý tìm kiếm khi nhấn Enter hoặc click vào biểu tượng tìm kiếm
  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?query=${searchQuery}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      dispatch(logout());
      navigate("/signin");
    }
  };

  const closeMenu = () => setIsMenuOpen(false);
  const showAdminLink = isAdminRole(user?.role);

  return (
    <header className="border-b bg-white shadow-md">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-2xl font-semibold text-purple-600 tracking-wide hover:text-purple-800">
          D4CClothingShop
        </Link>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center space-x-8 text-lg">
          <Link to="/" className="text-gray-700 hover:text-purple-600 transition-all">Products</Link>
          {showAdminLink ? (
            <Link to="/admin" className="text-gray-700 hover:text-purple-600 transition-all">Admin</Link>
          ) : null}
          {isAuthenticated ? (
            <>
              <Link to="/profile" className="text-gray-700 hover:text-purple-600 transition-all">Profile</Link>
              <button className="text-gray-700 hover:text-purple-600 transition-all" onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/signin" className="text-gray-700 hover:text-purple-600 transition-all">Sign in</Link>
              <Link to="/signup" className="text-gray-700 hover:text-purple-600 transition-all">Sign up</Link>
            </>
          )}
        </nav>

        {/* Icon Buttons */}
        <div className="flex items-center space-x-6">
          {/* Tìm kiếm */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              className="p-2 pl-10 pr-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              aria-label="Search"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-500"
              onClick={handleSearch}
            >
              <Search size={20} />
            </button>
          </div>
          <button aria-label="Menu" className="p-2 md:hidden" onClick={toggleMenu}>
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-white shadow-md">
          <nav className="flex flex-col px-6 py-4">
            <Link to="/" className="py-2 text-gray-700 hover:text-purple-600 transition-all" onClick={closeMenu}>Products</Link>
            {showAdminLink ? (
              <Link to="/admin" className="py-2 text-gray-700 hover:text-purple-600 transition-all" onClick={closeMenu}>Admin</Link>
            ) : null}
            {isAuthenticated ? (
              <>
                <Link to="/profile" className="py-2 text-gray-700 hover:text-purple-600 transition-all" onClick={closeMenu}>Profile</Link>
                <button className="py-2 text-left text-gray-700 hover:text-purple-600 transition-all" onClick={() => { closeMenu(); handleSignOut(); }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/signin" className="py-2 text-gray-700 hover:text-purple-600 transition-all" onClick={closeMenu}>Sign in</Link>
                <Link to="/signup" className="py-2 text-gray-700 hover:text-purple-600 transition-all" onClick={closeMenu}>Sign up</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
