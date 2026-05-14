import { dynamoClient } from "../config/aws.config.js";
import {
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const TABLE_NAME = process.env.SCORE_TABLE_NAME || "d4c_user_scores";

class RecommendationModel {
  async upsertScore(userId, productId, delta) {
    try {
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId, productId },
        UpdateExpression:
          "SET #score = if_not_exists(#score, :zero) + :delta, #updatedAt = :now",
        ExpressionAttributeNames: {
          "#score": "score",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":delta": delta,
          ":zero": 0,
          ":now": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      });
      const response = await dynamoClient.send(command);
      return response.Attributes;
    } catch {
      const item = {
        userId,
        productId,
        score: delta,
        updatedAt: new Date().toISOString(),
      };
      await dynamoClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return item;
    }
  }

  async findTopByUserId(userId, limit = 20) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "userId-score-index",
        KeyConditionExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false,
        Limit: limit,
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
      const items = response.Items || [];
      return items
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, limit);
    }
  }
}

export const recommendationModel = new RecommendationModel();
