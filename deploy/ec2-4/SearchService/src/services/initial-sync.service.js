import axios from "axios";
import { toTypesenseDocs } from "../utils/product-transformer.js";
import { upsertDocs } from "./sync.service.js";

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:8082";

const apiClient = axios.create({
  timeout: 30000,
  baseURL: PRODUCT_SERVICE_URL,
});

export async function initialSync() {
  console.log("Starting initial sync from ProductService...");

  let page = 1;
  const limit = 250;
  let totalSynced = 0;
  let totalPages = Infinity;

  while (page <= totalPages) {
    console.log(`Fetching page ${page}/${totalPages}`);

    const response = await apiClient.get(`/api/products?page=${page}&limit=${limit}`);
    const envelope = response.data;
    const products = Array.isArray(envelope.data) ? envelope.data : [];

    totalPages = envelope.totalPages || 1;

    if (products.length === 0) {
      console.log("No more products to sync");
      break;
    }

    const docs = toTypesenseDocs(products);

    const results = await upsertDocs(docs);
    const successCount = results.filter((r) => r.success).length;
    totalSynced += successCount;

    console.log(`Synced ${successCount}/${products.length} products (total: ${totalSynced})`);
    page++;
  }

  console.log(`Initial sync complete: ${totalSynced} products indexed in Typesense`);
  return totalSynced;
}
