import dotenv from "dotenv";
dotenv.config();

import { ensureCollection } from "../src/services/sync.service.js";
import { initialSync } from "../src/services/initial-sync.service.js";

async function main() {
  try {
    console.log("=== Typesense Initial Sync ===");
    await ensureCollection();
    await initialSync();
    console.log("=== Sync finished successfully ===");
    process.exit(0);
  } catch (err) {
    console.error("Sync failed:", err);
    process.exit(1);
  }
}

main();
