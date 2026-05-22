import { stockService } from "../services/stock.service.js";

export const deductBatchStock = async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Request body must be a non-empty array of { variantId, quantity }" });
    }

    for (const item of items) {
      if (!item.variantId || !item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        return res
          .status(400)
          .json({ message: `Invalid item: each item must have variantId (string) and quantity (positive integer)` });
      }
    }

    const result = await stockService.batchDeductStock(items);

    if (result.success) {
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({
      success: false,
      failedItems: result.failedItems
    });
  } catch (error) {
    console.error("Lỗi batch deduct stock:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xử lý trừ tồn kho hàng loạt", error: error.message });
  }
};

export const restoreBatchStock = async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Request body must be a non-empty array of { variantId, quantity }" });
    }

    for (const item of items) {
      if (!item.variantId || !item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        return res
          .status(400)
          .json({ message: `Invalid item: each item must have variantId (string) and quantity (positive integer)` });
      }
    }

    const result = await stockService.batchRestoreStock(items);

    if (result.success) {
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({
      success: false,
      failedItems: result.failedItems
    });
  } catch (error) {
    console.error("Lỗi batch restore stock:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xử lý hoàn tồn kho hàng loạt", error: error.message });
  }
};
