import { toTypesenseDoc } from "./product-transformer.js";
import { toCategoryTypesenseDoc } from "./category-transformer.js";
import { upsertDoc, deleteDoc, upsertCategoryDoc, deleteCategoryDoc } from "../services/sync.service.js";

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
