import { useState } from "react";
import { useCreateProductMutation } from "../hooks/useProducts";

const CATEGORY_OPTIONS = ["Áo", "Quần", "Giày", "Phụ kiện"];
const GENDER_OPTIONS = ["Nam", "Nữ", "Unisex"];
const BRAND_OPTIONS = ["D4C", "Nike", "Adidas", "Zara", "H&M", "Uniqlo", "Local Brand"];
const COLOR_OPTIONS = ["Đen", "Trắng", "Xám", "Đỏ", "Xanh Navy", "Xanh Dương", "Xanh Lá", "Vàng", "Hồng", "Nâu"];
const SIZE_LIST = ["XS", "S", "M", "L", "XL", "XXL"];

export default function AddProduct({ onSubmitSuccess }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Áo");
  const [gender, setGender] = useState("Unisex");
  const [brand, setBrand] = useState("D4C");
  const [selectedColors, setSelectedColors] = useState([]);
  const [tags, setTags] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [stock, setStock] = useState(
    SIZE_LIST.map((size) => ({ size, quantity: 0 }))
  );
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const { mutateAsync: createProduct, isPending: loading } = useCreateProductMutation();

  const handleImageUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleStockChange = (size, value) => {
    setStock((prev) =>
      prev.map((item) => item.size === size ? { ...item, quantity: Number(value) } : item)
    );
  };

  const toggleColor = (color) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !description || !price || !file) {
      alert("Vui lòng điền đầy đủ thông tin và chọn ảnh sản phẩm.");
      return;
    }
    if (!stock.some((item) => item.quantity > 0)) {
      alert("Vui lòng nhập số lượng cho ít nhất một size.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("price", price);
      formData.append("stock", JSON.stringify(stock));
      formData.append("category", category);
      formData.append("gender", gender);
      formData.append("brand", brand);
      formData.append("colors", JSON.stringify(selectedColors));
      formData.append("tags", JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)));
      formData.append("isFeatured", String(isFeatured));
      formData.append("productImage", file);

      await createProduct(formData);

      alert("✅ Sản phẩm đã được thêm thành công!");
      // Reset form
      setName(""); setDescription(""); setPrice(""); setCategory("Áo");
      setGender("Unisex"); setBrand("D4C"); setSelectedColors([]); setTags("");
      setIsFeatured(false); setFile(null); setImagePreview("");
      setStock(SIZE_LIST.map((size) => ({ size, quantity: 0 })));
      onSubmitSuccess?.();
    } catch (error) {
      console.error("Error adding product:", error);
      alert("Có lỗi xảy ra khi thêm sản phẩm!");
    }
  };

  const inputCls = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all text-sm";
  const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="container px-4 py-8 mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Thêm Sản Phẩm Mới</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Left column */}
        <div className="space-y-5">
          {/* Tên */}
          <div>
            <label className={labelCls}>Tên Sản Phẩm *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className={inputCls} required disabled={loading} />
          </div>

          {/* Mô tả */}
          <div>
            <label className={labelCls}>Mô Tả *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className={inputCls} rows={4} required disabled={loading} />
          </div>

          {/* Giá */}
          <div>
            <label className={labelCls}>Giá (VNĐ) *</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
              className={inputCls} required min="0" disabled={loading} />
          </div>

          {/* Hình ảnh */}
          <div>
            <label className={labelCls}>Hình Ảnh *</label>
            <input type="file" accept="image/*" onChange={handleImageUpload}
              className={inputCls} required disabled={loading} />
            {imagePreview && (
              <img src={imagePreview} alt="Preview"
                className="mt-3 w-32 h-32 object-cover rounded-xl border border-gray-200 shadow-sm" />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags (phân cách bằng dấu phẩy)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="cotton, basic, casual" className={inputCls} disabled={loading} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Category */}
          <div>
            <label className={labelCls}>Danh Mục *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className={inputCls} disabled={loading}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className={labelCls}>Giới Tính</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)}
              className={inputCls} disabled={loading}>
              {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className={labelCls}>Thương Hiệu</label>
            <select value={brand} onChange={(e) => setBrand(e.target.value)}
              className={inputCls} disabled={loading}>
              {BRAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Colors */}
          <div>
            <label className={labelCls}>Màu Sắc</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => toggleColor(c)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200
                    ${selectedColors.includes(c)
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-gray-300 text-gray-600 hover:border-purple-400"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className={labelCls}>Số Lượng Theo Size *</label>
            <div className="grid grid-cols-3 gap-2">
              {stock.map(({ size, quantity }) => (
                <div key={size} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-500 w-8">{size}</span>
                  <input type="number" value={quantity}
                    onChange={(e) => handleStockChange(size, e.target.value)}
                    className={`${inputCls} text-center`} min="0" disabled={loading} />
                </div>
              ))}
            </div>
          </div>

          {/* isFeatured */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isFeatured" checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600" disabled={loading} />
            <label htmlFor="isFeatured" className="text-sm font-medium text-gray-700 cursor-pointer">
              ⭐ Đánh dấu là sản phẩm nổi bật
            </label>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-200
              ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-purple-200 active:scale-95"}`}>
            {loading ? "Đang thêm..." : "Thêm Sản Phẩm"}
          </button>
        </div>
      </form>
    </div>
  );
}
