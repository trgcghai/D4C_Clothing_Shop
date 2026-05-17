import { toTypesenseDoc } from "./product-transformer.js";
import { upsertDoc, deleteDoc } from "../services/sync.service.js";

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
    default:
      console.warn(`Unknown event type: ${eventType}`);
      break;
  }
}
