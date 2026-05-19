import typesenseClient from "../config/typesense.config.js";
import { normalizeVietnamese } from "../utils/product-transformer.js";

const COLLECTION_NAME = "d4c_products";

function escapeFilterValue(val) {
  return String(val).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function flattenFilterValue(value) {
  const arr = Array.isArray(value) ? value : [value];
  return arr.flatMap((v) => v.split(",").map((x) => x.trim()).filter(Boolean));
}

export function buildFilterString(query) {
  const filters = [];

  if (query.filter_by) {
    filters.push(query.filter_by);
  }

  if (query.category) {
    const cats = flattenFilterValue(query.category);
    const catExpr = cats.map((c) => `category_norm:="${escapeFilterValue(normalizeVietnamese(c))}"`).join(" || ");
    filters.push(catExpr);
  }

  if (query.brand) {
    const brands = flattenFilterValue(query.brand);
    const brandExpr = brands.map((b) => `brand_norm:="${escapeFilterValue(normalizeVietnamese(b))}"`).join(" || ");
    filters.push(brandExpr);
  }

  if (query.priceMin !== undefined && query.priceMin !== "") {
    const minVal = Number(query.priceMin);
    if (!Number.isNaN(minVal)) {
      filters.push(`price:>=${minVal}`);
    }
  }

  if (query.priceMax !== undefined && query.priceMax !== "") {
    const maxVal = Number(query.priceMax);
    if (!Number.isNaN(maxVal)) {
      filters.push(`price:<=${maxVal}`);
    }
  }

  if (query.size) {
    const sizes = flattenFilterValue(query.size);
    const sizeExpr = sizes.map((s) => `sizes:="${escapeFilterValue(s)}"`).join(" || ");
    filters.push(sizeExpr);
  }

  if (query.color) {
    const colors = flattenFilterValue(query.color);
    const colorExpr = colors.map((c) => `colors:="${escapeFilterValue(c)}"`).join(" || ");
    filters.push(colorExpr);
  }

  return filters.length > 0 ? filters.join(" && ") : undefined;
}

export async function searchProducts(query, options = {}) {
  const {
    page = 1,
    limit = 12,
    filter_by,
    sort_by = "_text_match:desc",
  } = options;

  const allowedSortFields = ["_text_match", "price", "createdAt", "name"];
  const rawSortBy = sort_by || "_text_match:desc";
  const validatedSortBy = rawSortBy
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      const field = s.split(":")[0];
      return allowedSortFields.includes(field);
    })
    .join(",") || "_text_match:desc";

  const searchParams = {
    collection: COLLECTION_NAME,
    q: query,
    query_by: "category,tags,brand,name,description,category_norm,tags_norm,brand_norm,name_norm,description_norm",
    query_by_weights: "100,80,60,4,2,100,80,60,4,2",
    prefix: true,
    num_typos: 2,
    split_join_tokens: true,
    typo_tokens_threshold: 1,
    sort_by: validatedSortBy,
    per_page: Math.min(250, Math.max(1, Number(limit))),
    page: Math.max(1, Number(page)),
    exclude_fields: "embedding",
    drop_tokens_threshold: 1,
  };

  if (filter_by) {
    searchParams.filter_by = filter_by;
  }

  const startTime = Date.now();
  const result = await typesenseClient.multiSearch.perform({
    searches: [searchParams],
  });
  const searchTimeMs = Date.now() - startTime;

  const searchResult = result.results[0];
  const hits = searchResult.hits || [];
  const total = searchResult.found || 0;
  const perPage = searchResult.request_params?.per_page || searchParams.per_page;
  const totalPages = Math.ceil(total / perPage) || 1;

  const data = hits.map((hit) => ({
    ...hit.document,
    _text_match: hit.text_match,
    _vector_distance: hit.vector_distance,
  }));

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
    keyword: query,
    searchTimeMs,
  };
}
