import axios from "axios";
import { toTypesenseDocs } from "../utils/product-transformer.js";
import { upsertDocs } from "./sync.service.js";

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:8082";

const apiClient = axios.create({
  timeout: 30000,
  baseURL: PRODUCT_SERVICE_URL,
});

export async function reindexProductsByCategory(categoryId) {
  console.log(`Starting reindex for category ${categoryId}...`);

  let page = 1;
  const limit = 250;
  let totalSynced = 0;
  let totalPages = Infinity;

  try {
    while (page <= totalPages) {
      const response = await apiClient.get(`/api/products`, {
        params: { categoryId, page, limit },
      });
      const envelope = response.data;
      const products = Array.isArray(envelope.data) ? envelope.data : [];

      totalPages = envelope.totalPages || 1;

      if (products.length === 0) {
        break;
      }

      const docs = toTypesenseDocs(products);
      const results = await upsertDocs(docs);
      const successCount = results.filter((r) => r.success).length;
      totalSynced += successCount;

      console.log(`Reindexed ${successCount}/${products.length} products for category ${categoryId} (total: ${totalSynced})`);
      page++;
    }

    console.log(`Category reindex complete: ${totalSynced} products updated`);
    return totalSynced;
  } catch (err) {
    console.error(`Failed to reindex products for category ${categoryId}:`, err.message);
    throw err;
  }
}
