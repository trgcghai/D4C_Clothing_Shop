import { useState } from "react";
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from "lucide-react";

const GENDERS = ["Nam", "Nữ", "Unisex"];
const CATEGORIES = ["Áo", "Quần", "Giày", "Phụ kiện"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const PRICE_RANGES = [
  { label: "Dưới 100.000₫", min: "", max: "100000" },
  { label: "100.000 - 200.000₫", min: "100000", max: "200000" },
  { label: "200.000 - 300.000₫", min: "200000", max: "300000" },
  { label: "300.000 - 400.000₫", min: "300000", max: "400000" },
  { label: "Trên 400.000₫", min: "400000", max: "" },
];
const COLORS = [
  { name: "Đen", hex: "#1a1a1a" },
  { name: "Trắng", hex: "#f5f5f5" },
  { name: "Xám", hex: "#9ca3af" },
  { name: "Đỏ", hex: "#ef4444" },
  { name: "Xanh Navy", hex: "#1e3a5f" },
  { name: "Xanh Dương", hex: "#3b82f6" },
  { name: "Xanh Lá", hex: "#22c55e" },
  { name: "Vàng", hex: "#f59e0b" },
  { name: "Hồng", hex: "#ec4899" },
  { name: "Nâu", hex: "#92400e" },
];
const BRANDS = ["D4C", "Nike", "Adidas", "Zara", "H&M", "Uniqlo", "Local Brand"];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 pb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}

function CheckItem({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400 cursor-pointer"
      />
      <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{label}</span>
    </label>
  );
}

/**
 * Fashion-specific filter sidebar.
 * Props:
 *   filters: { category, gender, size, color, brand, minPrice, maxPrice }
 *   updateFilter(key, value)
 *   clearFilters()
 *   activeFilterCount: number
 */
export default function FilterSidebar({ filters, updateFilter, clearFilters, activeFilterCount }) {
  const { category, gender, size, color, brand, minPrice, maxPrice } = filters;

  // Selected price range (identify from minPrice/maxPrice)
  const selectedPriceLabel = PRICE_RANGES.find(
    (r) => r.min === (minPrice || "") && r.max === (maxPrice || "")
  )?.label || "";

  const handlePriceRange = (range) => {
    if (selectedPriceLabel === range.label) {
      // deselect
      updateFilter("minPrice", "");
      updateFilter("maxPrice", "");
    } else {
      updateFilter("minPrice", range.min);
      updateFilter("maxPrice", range.max);
    }
  };

  // Multi-select helpers for size (comma-separated string)
  const selectedSizes = size ? size.split(",").map((s) => s.trim()) : [];
  const toggleSize = (s) => {
    const next = selectedSizes.includes(s)
      ? selectedSizes.filter((x) => x !== s)
      : [...selectedSizes, s];
    updateFilter("size", next.join(","));
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-purple-600" />
          <h2 className="font-bold text-gray-800">Bộ Lọc</h2>
          {activeFilterCount > 0 && (
            <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
          >
            <X className="w-3 h-3" />
            Xóa tất cả
          </button>
        )}
      </div>

      {/* Gender */}
      <Section title="Giới Tính">
        {GENDERS.map((g) => (
          <CheckItem
            key={g}
            checked={gender === g}
            onChange={() => updateFilter("gender", gender === g ? "" : g)}
            label={g}
          />
        ))}
      </Section>

      {/* Category */}
      <Section title="Danh Mục">
        {CATEGORIES.map((cat) => (
          <CheckItem
            key={cat}
            checked={category === cat}
            onChange={() => updateFilter("category", category === cat ? "" : cat)}
            label={cat}
          />
        ))}
      </Section>

      {/* Price Range */}
      <Section title="Khoảng Giá">
        {PRICE_RANGES.map((range) => (
          <CheckItem
            key={range.label}
            checked={selectedPriceLabel === range.label}
            onChange={() => handlePriceRange(range)}
            label={range.label}
          />
        ))}
      </Section>

      {/* Size */}
      <Section title="Size">
        <div className="flex flex-wrap gap-2 pt-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSize(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-200
                ${selectedSizes.includes(s)
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                  : "border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-600"
                }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      {/* Color */}
      <Section title="Màu Sắc" defaultOpen={false}>
        <div className="flex flex-wrap gap-2 pt-1">
          {COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => updateFilter("color", color === c.name ? "" : c.name)}
              title={c.name}
              className={`w-7 h-7 rounded-full border-2 transition-all duration-200 hover:scale-110
                ${color === c.name ? "border-purple-600 scale-110 ring-2 ring-purple-300" : "border-gray-200"}`}
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
            />
          ))}
        </div>
        {color && (
          <p className="text-xs text-gray-500 mt-1">Đang chọn: <span className="font-medium text-gray-700">{color}</span></p>
        )}
      </Section>

      {/* Brand */}
      <Section title="Thương Hiệu" defaultOpen={false}>
        {BRANDS.map((b) => (
          <CheckItem
            key={b}
            checked={brand === b}
            onChange={() => updateFilter("brand", brand === b ? "" : b)}
            label={b}
          />
        ))}
      </Section>
    </div>
  );
}
