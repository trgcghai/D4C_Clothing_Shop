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

class BehaviorModel {
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

  async findByUserId(userId) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false,
      });
      const response = await dynamoClient.send(command);
      return response.Items || [];
    } catch {
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
