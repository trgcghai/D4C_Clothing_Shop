import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShoppingBag, ChevronRight, Tag, Package, Star } from "lucide-react";
import ProductCard from "../components/product-card";
import { useProductQuery, useRelatedProductsQuery } from "../hooks/useProducts";

const COLOR_MAP = {
  "Đen": "#1a1a1a",
  "Trắng": "#f5f5f5",
  "Xám": "#9ca3af",
  "Đỏ": "#ef4444",
  "Xanh Navy": "#1e3a5f",
  "Xanh Dương": "#3b82f6",
  "Xanh Lá": "#22c55e",
  "Vàng": "#f59e0b",
  "Hồng": "#ec4899",
  "Nâu": "#92400e",
};

export default function Product() {
  const { productId } = useParams();
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const {
    data: product,
    isLoading: productLoading,
    isFetching: productFetching,
    error: productError,
  } = useProductQuery(productId);
  const { data: relatedProducts = [] } = useRelatedProductsQuery(productId);
  const loading = productLoading || productFetching;
  const error = productError ? `Lỗi khi tải sản phẩm: ${productError.message}` : null;

  useEffect(() => {
    setSelectedSize("");
    setSelectedColor("");
  }, [productId]);

  useEffect(() => {
    if (product?.colors?.length === 1) setSelectedColor(product.colors[0]);
  }, [product]);

  const handleSizeChange = (size) => {
    const stockItem = product.stock.find((item) => item.size === size);
    if (Number(stockItem.quantity) === 0) {
      alert("Kích cỡ này đã hết hàng!");
      return;
    }
    setSelectedSize(size);
  };

  const handleAddToCart = () => {
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      alert("Vui lòng chọn màu sắc!");
      return;
    }
    if (!selectedSize) {
      alert("Vui lòng chọn kích cỡ!");
      return;
    }
    alert(`✅ ${product.name} (Màu: ${selectedColor || "Mặc định"}, Size: ${selectedSize}) đã được thêm vào giỏ hàng!`);
  };

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 animate-pulse">
        <div className="flex gap-2 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-200 rounded w-20" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="flex gap-2 mt-4">
              {[1,2,3,4].map(i => <div key={i} className="w-12 h-10 bg-gray-200 rounded-lg" />)}
            </div>
            <div className="h-12 bg-gray-200 rounded-xl w-full mt-4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Package className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg font-semibold text-gray-600">{error || "Sản phẩm không tồn tại!"}</p>
        <Link to="/" className="mt-4 text-purple-600 hover:underline text-sm">← Quay lại danh sách sản phẩm</Link>
      </div>
    );
  }

  const totalStock = product.stock
    ? product.stock.reduce((s, i) => s + Number(i.quantity), 0)
    : 0;
  const isOutOfStock = totalStock === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/" className="hover:text-purple-600 transition-colors">Trang chủ</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/all-products" className="hover:text-purple-600 transition-colors">Sản phẩm</Link>
          {product.category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-500">{product.category}</span>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700 font-medium truncate max-w-xs">{product.name}</span>
        </nav>

        {/* ── Product Detail ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

            {/* Image */}
            <div className="relative bg-gray-50 flex items-center justify-center p-8 min-h-[400px]">
              <img
                src={product.imageUrl || "/placeholder.svg?height=500&width=500"}
                alt={product.name}
                className="max-w-full max-h-[480px] object-contain rounded-xl"
              />
              {product.isFeatured && (
                <span className="absolute top-4 left-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                  ⭐ Nổi bật
                </span>
              )}
            </div>

            {/* Info */}
            <div className="p-8 space-y-5 border-l border-gray-100">
              {/* Brand */}
              {product.brand && (
                <p className="text-sm font-bold text-purple-500 uppercase tracking-widest">{product.brand}</p>
              )}

              {/* Name */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>

              {/* Price */}
              <p className="text-3xl font-extrabold text-purple-600">
                {Number(product.price).toLocaleString("vi-VN")}₫
              </p>

              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-sm">
                {product.category && (
                  <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                    <Tag className="w-3 h-3" />
                    {product.category}
                  </span>
                )}
                {product.gender && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
                    {product.gender}
                  </span>
                )}
                {isOutOfStock ? (
                  <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full font-medium">Hết hàng</span>
                ) : (
                  <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full font-medium">
                    Còn {totalStock} sản phẩm
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                  {product.description}
                </p>
              )}

              {/* Color selection */}
              {product.colors && product.colors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Màu sắc:
                    {selectedColor && <span className="ml-2 text-purple-600 font-medium">{selectedColor}</span>}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        title={c}
                        className={`w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110
                          ${selectedColor === c
                            ? "border-purple-600 scale-110 ring-2 ring-purple-300"
                            : "border-gray-200"
                          }`}
                        style={{ backgroundColor: COLOR_MAP[c] || "#ccc" }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Size selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Kích cỡ:
                  {selectedSize && <span className="ml-2 text-purple-600 font-medium">{selectedSize}</span>}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.stock.map((item) => {
                    const qty = Number(item.quantity);
                    const isOos = qty === 0;
                    return (
                      <button
                        key={item.size}
                        onClick={() => handleSizeChange(item.size)}
                        disabled={isOos}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-200
                          ${isOos
                            ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed line-through"
                            : selectedSize === item.size
                              ? "bg-purple-600 text-white border-purple-600 shadow-md"
                              : "border-gray-200 text-gray-700 hover:border-purple-400 hover:text-purple-600"
                          }`}
                        title={isOos ? "Hết hàng" : `Còn ${qty} cái`}
                      >
                        {item.size}
                        {!isOos && (
                          <span className="ml-1 text-[10px] opacity-60">({qty})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {product.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Add to cart button */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-base
                            transition-all duration-200 shadow-sm
                  ${isOutOfStock
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 text-white hover:shadow-lg hover:shadow-purple-200 active:scale-95"
                  }`}
              >
                <ShoppingBag className="w-5 h-5" />
                {isOutOfStock ? "Hết hàng" : "Thêm vào giỏ hàng"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Related Products ── */}
        {relatedProducts.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-2 mb-6">
              <Star className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-bold text-gray-900">Sản Phẩm Liên Quan</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
