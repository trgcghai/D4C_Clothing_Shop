import axios from "axios";
import { toCategoryTypesenseDoc } from "../utils/category-transformer.js";
import { upsertCategoryDoc } from "./sync.service.js";

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:8082";

const apiClient = axios.create({
  timeout: 30000,
  baseURL: PRODUCT_SERVICE_URL,
});

export async function initialCategorySync() {
  console.log("Starting initial category sync from ProductService...");

  try {
    const response = await apiClient.get("/api/categories");
    const categories = Array.isArray(response.data) ? response.data : [];

    if (categories.length === 0) {
      console.log("No categories to sync");
      return 0;
    }

    let totalSynced = 0;
    for (const cat of categories) {
      const doc = toCategoryTypesenseDoc(cat);
      await upsertCategoryDoc(doc);
      totalSynced++;
    }

    console.log(`Initial category sync complete: ${totalSynced} categories indexed in Typesense`);
    return totalSynced;
  } catch (err) {
    console.error("Category initial sync failed:", err.message);
    throw err;
  }
}
