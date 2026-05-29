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

const TABLE_NAME = process.env.TABLE_NAME || "d4c_products";

class ProductModel {
  async findAll() {
    const params = {
      TableName: TABLE_NAME,
    };
    const command = new ScanCommand(params);
    const response = await dynamoClient.send(command);
    return response.Items;
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

  /**
   * Scan DynamoDB with FilterExpression for server-side filtering
   * @param {Object} filters - { category, gender, size, color, brand, minPrice, maxPrice }
   */
  async findWithFilters(filters = {}) {
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    let idx = 0;

    const { categoryId, gender, brand, minPrice, maxPrice } = filters;

    if (categoryId) {
      filterExpressions.push(`#attr${idx} = :val${idx}`);
      expressionAttributeNames[`#attr${idx}`] = "categoryId";
      expressionAttributeValues[`:val${idx}`] = categoryId;
      idx++;
    }

    if (gender) {
      filterExpressions.push(`#attr${idx} = :val${idx}`);
      expressionAttributeNames[`#attr${idx}`] = "gender";
      expressionAttributeValues[`:val${idx}`] = gender;
      idx++;
    }

    if (brand) {
      filterExpressions.push(`#attr${idx} = :val${idx}`);
      expressionAttributeNames[`#attr${idx}`] = "brand";
      expressionAttributeValues[`:val${idx}`] = brand;
      idx++;
    }

    if (minPrice !== undefined && minPrice !== "") {
      filterExpressions.push(`#attr${idx} >= :val${idx}`);
      expressionAttributeNames[`#attr${idx}`] = "price";
      expressionAttributeValues[`:val${idx}`] = Number(minPrice);
      idx++;
    }

    if (maxPrice !== undefined && maxPrice !== "") {
      filterExpressions.push(`#attr${idx} <= :val${idx}`);
      expressionAttributeNames[`#attr${idx}`] = "price";
      expressionAttributeValues[`:val${idx}`] = Number(maxPrice);
      idx++;
    }

    const params = {
      TableName: TABLE_NAME,
    };

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(" AND ");
      params.ExpressionAttributeNames = expressionAttributeNames;
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    const command = new ScanCommand(params);
    const response = await dynamoClient.send(command);
    return response.Items || [];
  }

  /**
   * Search products by keyword in name, description, category
   * @param {string} keyword
   */
  async findByKeyword(keyword) {
    if (!keyword) return this.findAll();

    const kw = keyword.toLowerCase();

    // DynamoDB does not support full-text search natively;
    // we scan all and filter in JS
    const params = {
      TableName: TABLE_NAME,
    };

    const command = new ScanCommand(params);
    const response = await dynamoClient.send(command);
    const items = response.Items || [];

    return items.filter((item) => {
      const nameMatch = item.name && item.name.toLowerCase().includes(kw);
      const descMatch = item.description && item.description.toLowerCase().includes(kw);
      const brandMatch = item.brand && item.brand.toLowerCase().includes(kw);
      const tagMatch = item.tags && item.tags.some((t) => t.toLowerCase().includes(kw));
      return nameMatch || descMatch || brandMatch || tagMatch;
    });
  }

  /**
   * Get featured products (isFeatured === true)
   */
  async findFeatured() {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: "#f = :true",
      ExpressionAttributeNames: { "#f": "isFeatured" },
      ExpressionAttributeValues: { ":true": true },
    };
    const command = new ScanCommand(params);
    const response = await dynamoClient.send(command);
    return response.Items || [];
  }

  /**
   * Get latest products sorted by createdAt descending
   * @param {number} limit
   */
  async findLatest(limit = 8) {
    const params = {
      TableName: TABLE_NAME,
    };
    const command = new ScanCommand(params);
    const response = await dynamoClient.send(command);
    const items = response.Items || [];
    return items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  /**
   * Get related products: same category, excluding current product
   * @param {string} category
   * @param {string} excludeId
   * @param {number} limit
   */
  async findRelated(categoryId, excludeId, limit = 6) {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: "#cat = :cat AND #id <> :excludeId",
      ExpressionAttributeNames: { "#cat": "categoryId", "#id": "id" },
      ExpressionAttributeValues: { ":cat": categoryId, ":excludeId": excludeId },
    };
    const command = new ScanCommand(params);
    const response = await dynamoClient.send(command);
    const items = response.Items || [];
    return items.slice(0, limit);
  }

  async create(productData) {
    const params = {
      TableName: TABLE_NAME,
      Item: productData,
    };
    const command = new PutCommand(params);
    await dynamoClient.send(command);
    return productData;
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
}

export const productModel = new ProductModel();
