import { dynamoClient } from "../config/aws.config.js";
import {
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const TABLE_NAME = process.env.BEHAVIOR_TABLE_NAME || "d4c_user_behaviors";

/**
 * Model for user behavior events table (DynamoDB)
 *
 * Table schema (to be created in AWS):
 *   PK: id (String)
 *   GSI: userId-createdAt-index  (userId → sort by createdAt)
 *
 * Item shape:
 * {
 *   id:          string   (UUID)
 *   userId:      string
 *   productId:   string
 *   eventType:   "view" | "add_to_cart" | "buy_now" | "purchased"
 *   createdAt:   string   (ISO)
 * }
 */
class BehaviorModel {
  /**
   * Record a single behavior event.
   */
  async putEvent({ userId, productId, eventType }) {
    const item = {
      id: uuidv4(),
      userId,
      productId,
      eventType,
      createdAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    });

    await dynamoClient.send(command);
    return item;
  }

  /**
   * Get all behavior events for a user (scan fallback – use GSI in prod).
   */
  async findByUserId(userId) {
    // Try QueryCommand with GSI first; fall back to Scan if GSI not yet created
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false, // newest first
      });
      const response = await dynamoClient.send(command);
      return response.Items || [];
    } catch {
      // GSI not available – scan and filter
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
      });
      const response = await dynamoClient.send(command);
      return (response.Items || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }
  }
}

export const behaviorModel = new BehaviorModel();
