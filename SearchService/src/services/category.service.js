import typesenseClient from "../config/typesense.config.js";

const COLLECTION_NAME = "d4c_categories";

export async function searchCategories(options = {}) {
  const {
    q = "*",
    page = 1,
    limit = 20,
    sort_by = "createdAt:desc",
  } = options;

  const allowedSortFields = ["name", "createdAt"];
  const rawSortBy = sort_by || "createdAt:desc";
  const validatedSortBy = rawSortBy
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      const field = s.split(":")[0];
      return allowedSortFields.includes(field);
    })
    .join(",") || "createdAt:desc";

  const searchParams = {
    collection: COLLECTION_NAME,
    q: q,
    query_by: "name,description",
    page: Math.max(1, Number(page)),
    per_page: Math.min(100, Math.max(1, Number(limit))),
    sort_by: validatedSortBy,
  };

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
  }));

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
    keyword: q === "*" ? "" : q,
    searchTimeMs,
  };
}
