import { toTypesenseDoc } from "./product-transformer.js";
import { toCategoryTypesenseDoc } from "./category-transformer.js";
import {
  upsertDoc,
  deleteDoc,
  upsertCategoryDoc,
  deleteCategoryDoc,
} from "../services/sync.service.js";
import { reindexProductsByCategory } from "../services/product-reindex.service.js";

export async function processEvent(eventType, data) {
  switch (eventType) {
    case "CREATE":
    case "UPDATE":
      const doc = toTypesenseDoc(data);
      await upsertDoc(doc);
      console.log(`Product ${data.id} synced to Typesense (${eventType})`);
      break;
    case "DELETE":
      await deleteDoc(data.id);
      console.log(`Product ${data.id} removed from Typesense`);
      break;
    case "CATEGORY_CREATED":
    case "CATEGORY_UPDATED":
      const catDoc = toCategoryTypesenseDoc(data);
      await upsertCategoryDoc(catDoc);
      console.log(`Category ${data.id} synced to Typesense (${eventType})`);

      // Reindex products when category is updated to refresh denormalized category name
      if (eventType === "CATEGORY_UPDATED" && data.id) {
        try {
          await reindexProductsByCategory(data.id);
        } catch (err) {
          console.error(
            `Failed to reindex products for category ${data.id}:`,
            err.message,
          );
          throw err; // Rethrow to trigger retry mechanism
        }
      }
      break;
    case "CATEGORY_DELETED":
      await deleteCategoryDoc(data.id);
      console.log(`Category ${data.id} removed from Typesense`);
      break;
    default:
      console.warn(`Unknown event type: ${eventType}`);
      break;
  }
}
