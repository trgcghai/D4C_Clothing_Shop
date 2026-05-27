import swaggerJSDoc from "swagger-jsdoc";

const PORT = process.env.PORT || 8088;
const SERVER_URL = process.env.AI_SERVICE_SERVER_URL || `http://localhost:${PORT}`;

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "D4C AI Service API",
      version: "1.0.0",
      description: "AI-powered chat assistant APIs for D4C Clothing Shop. Supports customer shopping assistance and admin operations via Google Gemini.",
    },
    servers: [
      {
        url: SERVER_URL,
        description: "Local environment",
      },
    ],
    tags: [
      { name: "chat", description: "AI chat conversation endpoints" },
    ],
    components: {
      schemas: {
        ChatMessage: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["user", "model"], example: "user" },
            content: { type: "string", example: "Tìm áo thun nam" },
            timestamp: { type: "integer", format: "int64", example: 1715700000000 },
          },
        },
        ChatResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                reply: { type: "string", example: "Đây là danh sách áo thun nam..." },
                role: { type: "string", example: "USER" },
              },
            },
          },
        },
        ConversationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                messages: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ChatMessage" },
                },
              },
            },
          },
        },
        ClearResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Message is required" },
          },
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token from UserService. Gateway validates and forwards X-User-* headers.",
        },
      },
    },
    security: [
      { BearerAuth: [] },
    ],
  },
  apis: ["./src/routes/*.js"],
};

export const openApiSpec = swaggerJSDoc(options);
