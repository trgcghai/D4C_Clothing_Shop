import express from "express";
import { handleDlqRetry } from "../controllers/admin.controller.js";
import { initialSync } from "../services/initial-sync.service.js";

const router = express.Router();

router.post("/dlq/retry", handleDlqRetry);
router.post("/sync", async (req, res) => {
  try {
    const count = await initialSync();
    res.json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
