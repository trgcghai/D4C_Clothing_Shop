import { productService } from "../services/product.service.js";

export async function handleOrderCancelled(event) {
  const { orderId, items } = event;

  if (!items || items.length === 0) {
    console.warn(`Order ${orderId} has no items to restore stock for`);
    return;
  }

  console.log(`Restoring stock for cancelled order ${orderId} with ${items.length} items`);

  for (const item of items) {
    const { variantId, quantity } = item;
    if (!variantId || !quantity) {
      console.warn(`Invalid item in order ${orderId}: missing variantId or quantity`);
      continue;
    }
    try {
      await productService.restoreVariantStock(variantId, quantity);
      console.log(`Restored ${quantity} stock for variant ${variantId}`);
    } catch (err) {
      console.error(`Failed to restore stock for variant ${variantId}:`, err.message);
      throw err;
    }
  }

  console.log(`Successfully restored stock for order ${orderId}`);
}
