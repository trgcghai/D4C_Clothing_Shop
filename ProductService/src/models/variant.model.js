import { dynamoClient } from "../config/aws.config.js";
import {
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const TABLE_NAME = process.env.VARIANT_TABLE_NAME || "d4c_variants";

class VariantModel {
  async findAll() {
    const params = { TableName: TABLE_NAME };
    let allItems = [];
    let lastKey = undefined;
    do {
      if (lastKey) params.ExclusiveStartKey = lastKey;
      const response = await dynamoClient.send(new ScanCommand(params));
      allItems = allItems.concat(response.Items || []);
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);
    return allItems;
  }

  async findByProductId(productId) {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: "productId = :pid",
      ExpressionAttributeValues: {
        ":pid": productId,
      },
    };
    const command = new ScanCommand(params);
    const response = await dynamoClient.send(command);
    return response.Items || [];
  }

  async findById(id) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id },
    };
    const command = new GetCommand(params);
    const response = await dynamoClient.send(command);
    return response.Item;
  }

  async create(variantData) {
    const params = {
      TableName: TABLE_NAME,
      Item: variantData,
    };
    const command = new PutCommand(params);
    await dynamoClient.send(command);
    return variantData;
  }

  async update(id, updateData) {
    let updateExpression = "SET";
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updateData).forEach((key, index) => {
      updateExpression += ` #attr${index} = :val${index},`;
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = updateData[key];
    });

    updateExpression = updateExpression.slice(0, -1);

    const params = {
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    };

    const command = new UpdateCommand(params);
    const response = await dynamoClient.send(command);
    return response.Attributes;
  }

  async remove(id) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id },
    };
    const command = new DeleteCommand(params);
    await dynamoClient.send(command);
    return true;
  }

  async removeByProductId(productId) {
    const variants = await this.findByProductId(productId);
    for (const variant of variants) {
      await this.remove(variant.id);
    }
    return true;
  }
}

export const variantModel = new VariantModel();
