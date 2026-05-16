const VI_DIACRITICS_MAP = {
  a: "áàảãạăắằẳẵặâấầẩẫậ",
  A: "ÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ",
  e: "éèẻẽẹêếềểễệ",
  E: "ÉÈẺẼẸÊẾỀỂỄỆ",
  i: "íìỉĩị",
  I: "ÍÌỈĨỊ",
  o: "óòỏõọôốồổỗộơớờởỡợ",
  O: "ÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ",
  u: "úùủũụưứừửữự",
  U: "ÚÙỦŨỤƯỨỪỬỮỰ",
  y: "ýỳỷỹỵ",
  Y: "ÝỲỶỸỴ",
  d: "đ",
  D: "Đ",
};

function normalizeVietnamese(text) {
  if (!text) return "";
  let result = String(text);
  for (const [base, variants] of Object.entries(VI_DIACRITICS_MAP)) {
    for (const ch of variants) {
      result = result.replaceAll(ch, base);
    }
  }
  return result;
}

export function toTypesenseDoc(product) {
  const name = product.name || "";
  const description = product.description || "";
  const category = product.category || "";
  const brand = product.brand || "";
  const tags = Array.isArray(product.tags) ? product.tags : [];

  return {
    id: product.id,
    name,
    description,
    category,
    brand,
    gender: product.gender || null,
    price: Number(product.price) || 0,
    tags,
    imageUrl: product.imageUrl || "",
    isFeatured: product.isFeatured === true,
    createdAt: product.createdAt
      ? (() => {
          const ts = Date.parse(product.createdAt);
          return Number.isFinite(ts) ? Math.floor(ts / 1000) : 0;
        })()
      : 0,
    variants: product.variants || [],
    name_norm: normalizeVietnamese(name),
    description_norm: normalizeVietnamese(description),
    category_norm: normalizeVietnamese(category),
    brand_norm: normalizeVietnamese(brand),
    tags_norm: tags.map(normalizeVietnamese),
  };
}

export function toTypesenseDocs(products) {
  return products.map(toTypesenseDoc);
}
