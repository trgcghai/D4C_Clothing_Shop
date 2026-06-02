import { dynamoClient } from "../config/aws.config.js";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const TABLE_NAME = process.env.VARIANT_TABLE_NAME || "d4c_variants";

class StockService {
  async batchDeductStock(items, idempotencyKey) {
    if (idempotencyKey) {
      const { redisClient } = await import("../config/redis.config.js");
      const cached = await redisClient.get(`idempotency:${idempotencyKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    if (!items || items.length === 0) {
      return { success: true };
    }

    const transactItems = items.map(item => ({
      Update: {
        TableName: TABLE_NAME,
        Key: { id: item.variantId },
        UpdateExpression: "SET quantity = quantity - :qty",
        ConditionExpression: "attribute_exists(id) AND quantity >= :qty",
        ExpressionAttributeValues: {
          ":qty": item.quantity
        }
      }
    }));

    try {
      await dynamoClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
      const result = { success: true };

      if (idempotencyKey) {
        const { redisClient } = await import("../config/redis.config.js");
        await redisClient.set(`idempotency:${idempotencyKey}`, JSON.stringify(result), { EX: 3600 });
      }

      return result;
    } catch (error) {
      if (error.name === "TransactionCanceledException") {
        const failedItems = this.parseCancellationReasons(error, items);
        return { success: false, failedItems };
      }
      throw error;
    }
  }

  async batchRestoreStock(items) {
    if (!items || items.length === 0) {
      return { success: true };
    }

    const transactItems = items.map(item => ({
      Update: {
        TableName: TABLE_NAME,
        Key: { id: item.variantId },
        UpdateExpression: "SET quantity = quantity + :qty",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeValues: {
          ":qty": item.quantity
        }
      }
    }));

    try {
      await dynamoClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
      return { success: true };
    } catch (error) {
      if (error.name === "TransactionCanceledException") {
        const failedItems = this.parseCancellationReasons(error, items);
        return { success: false, failedItems };
      }
      throw error;
    }
  }

  parseCancellationReasons(error, items) {
    const failedItems = [];
    const cancellationReasons = error.CancellationReasons || [];

    for (let i = 0; i < cancellationReasons.length; i++) {
      const reason = cancellationReasons[i];
      if (reason && reason.Code !== "None") {
        const item = items[i];
        let failureReason = "UNKNOWN";
        if (reason.Code === "ConditionalCheckFailed") {
          failureReason = "INSUFFICIENT_STOCK";
        } else if (reason.Code === "ValidationError") {
          failureReason = "VALIDATION_ERROR";
        } else {
          failureReason = reason.Code || "UNKNOWN";
        }
        failedItems.push({
          variantId: item.variantId,
          reason: failureReason
        });
      }
    }

    return failedItems;
  }
}

export const stockService = new StockService();
