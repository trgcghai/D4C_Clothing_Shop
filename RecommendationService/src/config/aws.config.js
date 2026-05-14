import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const region = process.env.AWS_REGION || "ap-southeast-1";

const dynamoClientBase = new DynamoDBClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamoClient = DynamoDBDocumentClient.from(dynamoClientBase, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export { dynamoClient };
