import { stockService } from "../services/stock.service.js";
import { redisClient } from "../config/redis.config.js";

const IDEMPOTENCY_TTL = 86400;

export async function handleOrderCancelled(event) {
  const { orderId, checkoutOrderId, items } = event;

  if (!items || items.length === 0) {
    console.warn(`Order ${orderId} has no items to restore stock for`);
    return;
  }

  const effectiveOrderId = orderId || checkoutOrderId;

  const acquired = await redisClient.set(
    `idempotency:order_cancelled:${effectiveOrderId}`,
    "1",
    { NX: true, EX: IDEMPOTENCY_TTL }
  );

  if (!acquired) {
    console.log(`Order ${effectiveOrderId} stock already restored (idempotency check)`);
    return;
  }

  console.log(`Restoring stock for cancelled order ${effectiveOrderId} with ${items.length} items`);

  const stockItems = items
    .filter(item => item.variantId && item.quantity && item.quantity > 0)
    .map(item => ({ variantId: item.variantId, quantity: item.quantity }));

  if (stockItems.length === 0) {
    console.warn(`Order ${effectiveOrderId} has no valid items to restore`);
    return;
  }

  try {
    const result = await stockService.batchRestoreStock(stockItems);

    if (result.success) {
      console.log(`Successfully restored stock for order ${effectiveOrderId}`);
    } else {
      console.error(`Partial stock restoration failure for order ${effectiveOrderId}:`, result.failedItems);
      throw new Error(`Stock restoration failed for order ${effectiveOrderId}: ${JSON.stringify(result.failedItems)}`);
    }
  } catch (err) {
    console.error(`Failed to restore stock for order ${effectiveOrderId}:`, err.message);
    throw err;
  }
}
