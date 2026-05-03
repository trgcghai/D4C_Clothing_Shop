import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CATEGORY_OPTIONS = ["Áo", "Quần", "Giày", "Phụ kiện"];
const GENDER_OPTIONS = ["Nam", "Nữ", "Unisex"];
const BRAND_OPTIONS = ["D4C", "Nike", "Adidas", "Zara", "H&M", "Uniqlo", "Local Brand"];
const COLOR_OPTIONS = ["Đen", "Trắng", "Xám", "Đỏ", "Xanh Navy", "Xanh Dương", "Xanh Lá", "Vàng", "Hồng", "Nâu"];
const SIZE_LIST = ["XS", "S", "M", "L", "XL", "XXL"];

export default function EditProductForm({ formData, setFormData, editingProductId, onSubmitSuccess }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);

  useEffect(() => {
    setLoading(false);
    setFile(null);
  }, [editingProductId]);

  if (!formData) return null;

  // Ensure new fields exist with defaults for old products
  const safeFormData = {
    gender: "Unisex",
    brand: "D4C",
    colors: [],
    tags: [],
    isFeatured: false,
    ...formData,
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleStockChange = (size, value) => {
    // Ensure the size exists in stock
    const stockExists = (safeFormData.stock || []).some((s) => s.size === size);
    if (stockExists) {
      setFormData((prev) => ({
        ...prev,
        stock: prev.stock.map((item) =>
          item.size === size ? { ...item, quantity: Number(value) || 0 } : item
        ),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        stock: [...(prev.stock || []), { size, quantity: Number(value) || 0 }],
      }));
    }
  };

  // Ensure all sizes are represented
  const stockMap = Object.fromEntries((safeFormData.stock || []).map((s) => [s.size, s.quantity]));
  const fullStock = SIZE_LIST.map((size) => ({ size, quantity: stockMap[size] ?? 0 }));

  const handleImageChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFormData((prev) => ({ ...prev, imageUrl: URL.createObjectURL(selectedFile) }));
    }
  };

  const toggleColor = (color) => {
    const current = safeFormData.colors || [];
    setFormData((prev) => ({
      ...prev,
      colors: current.includes(color) ? current.filter((c) => c !== color) : [...current, color],
    }));
  };

  const handleTagsChange = (e) => {
    const rawTags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, tags: rawTags }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSend = new FormData();
      dataToSend.append("name", safeFormData.name);
      dataToSend.append("description", safeFormData.description);
      dataToSend.append("price", safeFormData.price);
      dataToSend.append("stock", JSON.stringify(fullStock));
      dataToSend.append("category", safeFormData.category);
      dataToSend.append("gender", safeFormData.gender);
      dataToSend.append("brand", safeFormData.brand);
      dataToSend.append("colors", JSON.stringify(safeFormData.colors || []));
      dataToSend.append("tags", JSON.stringify(safeFormData.tags || []));
      dataToSend.append("isFeatured", String(safeFormData.isFeatured || false));
      if (file) dataToSend.append("productImage", file);

      const response = await fetch(`${API_URL}/products/${editingProductId}`, {
        method: "PUT",
        body: dataToSend,
      });

      if (!response.ok) throw new Error("Lỗi khi cập nhật sản phẩm");

      alert("✅ Cập nhật thành công!");
      onSubmitSuccess();
    } catch (err) {
      console.error(err);
      alert("Có lỗi khi cập nhật.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all";
  const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">

      {/* Left column */}
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Tên sản phẩm *</label>
          <input name="name" type="text" value={safeFormData.name || ""}
            onChange={handleChange} disabled={loading} className={inputCls} required />
        </div>

        <div>
          <label className={labelCls}>Mô tả</label>
          <textarea name="description" rows={3} value={safeFormData.description || ""}
            onChange={handleChange} disabled={loading} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Hình (để trống nếu không đổi)</label>
          <input type="file" accept="image/*" onChange={handleImageChange}
            disabled={loading} className={`${inputCls} mb-2`} />
          {safeFormData.imageUrl ? (
            <img src={safeFormData.imageUrl} alt="preview"
              className="w-32 h-32 object-cover rounded-xl border border-gray-200" />
          ) : (
            <div className="w-32 h-32 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs">No Image</div>
          )}
        </div>

        <div>
          <label className={labelCls}>Tags (phân cách bằng dấu phẩy)</label>
          <input type="text" value={(safeFormData.tags || []).join(", ")}
            onChange={handleTagsChange} className={inputCls} disabled={loading}
            placeholder="cotton, basic, casual" />
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Giá (VNĐ) *</label>
          <input name="price" type="number" value={safeFormData.price || ""}
            onChange={handleChange} disabled={loading} className={inputCls} required min="0" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Danh mục</label>
            <select name="category" value={safeFormData.category || "Áo"}
              onChange={handleChange} disabled={loading} className={inputCls}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Giới tính</label>
            <select name="gender" value={safeFormData.gender || "Unisex"}
              onChange={handleChange} disabled={loading} className={inputCls}>
              {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Thương hiệu</label>
          <select name="brand" value={safeFormData.brand || "D4C"}
            onChange={handleChange} disabled={loading} className={inputCls}>
            {BRAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Màu sắc</label>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button key={c} type="button" onClick={() => toggleColor(c)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all
                  ${(safeFormData.colors || []).includes(c)
                    ? "bg-purple-600 text-white border-purple-600"
                    : "border-gray-300 text-gray-600 hover:border-purple-400"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Số lượng theo size *</label>
          <div className="grid grid-cols-3 gap-2">
            {fullStock.map(({ size, quantity }) => (
              <div key={size} className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-500 w-8">{size}</span>
                <input type="number" min="0" value={quantity}
                  onChange={(e) => handleStockChange(size, e.target.value)}
                  disabled={loading} className={`${inputCls} text-center`} required />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="edit-isFeatured" name="isFeatured"
            checked={safeFormData.isFeatured || false} onChange={handleChange}
            className="w-4 h-4 rounded text-purple-600" disabled={loading} />
          <label htmlFor="edit-isFeatured" className="text-sm font-medium text-gray-700 cursor-pointer">
            ⭐ Đánh dấu là sản phẩm nổi bật
          </label>
        </div>

        <button type="submit" disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-200
            ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 active:scale-95 shadow-md"}`}>
          {loading ? "Đang cập nhật..." : "Cập nhật sản phẩm"}
        </button>
      </div>
    </form>
  );
}
