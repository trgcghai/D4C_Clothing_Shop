import { dynamoClient } from "../config/aws.config.js";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const TABLE_NAME = process.env.DYNAMODB_TABLE_CHATS || "d4c_ai_chats";

class ChatModel {
  async getChatHistory(chatId) {
    const params = {
      TableName: TABLE_NAME,
      Key: { chatId },
    };
    try {
      const response = await dynamoClient.send(new GetCommand(params));
      return response.Item;
    } catch (error) {
      console.error("Error fetching chat history from DynamoDB:", error);
      return null;
    }
  }

  async saveChatHistory(chatId, userId, role, messages) {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        chatId,
        userId,
        role,
        messages,
        lastMessageAt: Date.now(),
      },
    };
    try {
      await dynamoClient.send(new PutCommand(params));
      return true;
    } catch (error) {
      console.error("Error saving chat history to DynamoDB:", error);
      return false;
    }
  }
}

export const chatModel = new ChatModel();
