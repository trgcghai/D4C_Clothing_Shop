import { Link } from "react-router-dom";
import { ShoppingBag, Eye } from "lucide-react";

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

export default function ProductCard({ product }) {
  const totalStock = product.stock
    ? product.stock.reduce((sum, s) => sum + Number(s.quantity), 0)
    : 0;
  const isOutOfStock = totalStock === 0;

  const isNew =
    product.createdAt &&
    new Date() - new Date(product.createdAt) < 7 * 24 * 60 * 60 * 1000; // 7 days

  const displayColors = (product.colors || []).slice(0, 5);

  return (
    <div className={`group relative rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-xl
                     transform transition-all duration-300 hover:-translate-y-1
                     ${isOutOfStock ? "opacity-75" : ""}`}>

      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        {product.isFeatured && (
          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            ⭐ Nổi bật
          </span>
        )}
        {isNew && !isOutOfStock && (
          <span className="bg-gradient-to-r from-green-400 to-teal-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            Mới
          </span>
        )}
        {isOutOfStock && (
          <span className="bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            Hết hàng
          </span>
        )}
      </div>

      {/* Image */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        <img
          src={product.imageUrl || "/placeholder.svg?height=300&width=300"}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                        flex items-center justify-center gap-3">
          <Link
            to={`/product/${product.id}`}
            className="bg-white text-gray-800 p-2.5 rounded-full hover:bg-purple-600 hover:text-white
                       transition-all duration-200 shadow-lg transform hover:scale-110"
            title="Xem chi tiết"
          >
            <Eye className="w-4 h-4" />
          </Link>
          {!isOutOfStock && (
            <button
              className="bg-purple-600 text-white p-2.5 rounded-full hover:bg-purple-700
                         transition-all duration-200 shadow-lg transform hover:scale-110"
              title="Thêm vào giỏ hàng"
              onClick={(e) => {
                e.preventDefault();
                alert(`${product.name} — Vui lòng chọn size trong trang chi tiết!`);
              }}
            >
              <ShoppingBag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <Link to={`/product/${product.id}`} className="block p-4 space-y-1.5">
        {/* Brand */}
        {product.brand && (
          <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide">{product.brand}</p>
        )}

        {/* Name */}
        <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 group-hover:text-purple-600 transition-colors">
          {product.name}
        </h3>

        {/* Category & Gender */}
        <p className="text-xs text-gray-400">
          {[product.category, product.gender].filter(Boolean).join(" · ")}
        </p>

        {/* Color swatches */}
        {displayColors.length > 0 && (
          <div className="flex items-center gap-1 pt-0.5">
            {displayColors.map((c) => (
              <span
                key={c}
                className="w-3.5 h-3.5 rounded-full border border-gray-200 inline-block"
                style={{ backgroundColor: COLOR_MAP[c] || "#ccc" }}
                title={c}
              />
            ))}
            {(product.colors || []).length > 5 && (
              <span className="text-[10px] text-gray-400">+{product.colors.length - 5}</span>
            )}
          </div>
        )}

        {/* Price */}
        <p className="text-base font-bold text-purple-600 pt-0.5">
          {Number(product.price).toLocaleString("vi-VN")}₫
        </p>
      </Link>
    </div>
  );
}
