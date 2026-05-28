import swaggerJSDoc from "swagger-jsdoc";

const PORT = process.env.PORT || 5000;
const SERVER_URL = process.env.PRODUCT_SERVICE_SERVER_URL || `http://localhost:${PORT}`;

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "D4C Product Service API",
      version: "1.0.0",
      description: "Product catalog and product management APIs for D4C Clothing Shop",
    },
    servers: [
      {
        url: SERVER_URL,
        description: "Local environment",
      },
    ],
    tags: [
      { name: "products", description: "Product browsing and management endpoints" },
      { name: "categories", description: "Category management endpoints" },
    ],
    components: {
      schemas: {
        ProductStockItem: {
          type: "object",
          properties: {
            size: { type: "string", example: "M" },
            quantity: { type: "integer", example: 12 },
          },
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "string", example: "4f2b97d0-4afd-486d-b52d-73a3183f6bd4" },
            name: { type: "string", example: "Basic Tee" },
            description: { type: "string", example: "Soft cotton t-shirt" },
            price: { type: "number", format: "double", example: 249000 },
            stock: {
              type: "array",
              items: { $ref: "#/components/schemas/ProductStockItem" },
            },
            category: { type: "string", example: "Tops" },
            gender: { type: "string", example: "Unisex" },
            brand: { type: "string", example: "D4C" },
            colors: { type: "array", items: { type: "string" }, example: ["Black", "White"] },
            tags: { type: "array", items: { type: "string" }, example: ["new", "summer"] },
            isFeatured: { type: "boolean", example: false },
            imageUrl: { type: "string", example: "https://example.com/product.jpg" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        PaginatedProducts: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Product" },
            },
            total: { type: "integer", example: 120 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 12 },
            totalPages: { type: "integer", example: 10 },
            keyword: { type: "string", example: "tee" },
          },
        },
        ProductUpsertRequest: {
          type: "object",
          required: ["name", "description", "price", "category"],
          properties: {
            name: { type: "string", example: "Basic Tee" },
            description: { type: "string", example: "Soft cotton t-shirt" },
            price: { type: "number", example: 249000 },
            stock: { type: "string", description: "JSON string for stock array", example: "[{\"size\":\"M\",\"quantity\":12}]" },
            category: { type: "string", example: "Tops" },
            gender: { type: "string", example: "Unisex" },
            brand: { type: "string", example: "D4C" },
            colors: { type: "string", description: "JSON string or comma-separated values", example: "[\"Black\",\"White\"]" },
            tags: { type: "string", description: "JSON string or comma-separated values", example: "[\"new\",\"summer\"]" },
            isFeatured: { type: "boolean", example: false },
            imageUrl: { type: "string", example: "https://example.com/image.jpg" },
            productImage: { type: "string", format: "binary" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Lỗi server khi lấy dữ liệu sản phẩm" },
            error: { type: "string", example: "Internal server error" },
          },
        },
        Category: {
          type: "object",
          properties: {
            id: { type: "string", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            name: { type: "string", example: "Tops" },
            description: { type: "string", example: "Áo các loại" },
            imageUrl: { type: "string", example: "https://example.com/category.jpg" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CategoryUpsertRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Tops" },
            description: { type: "string", example: "Áo các loại" },
            categoryImage: { type: "string", format: "binary" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"],
};

export const openApiSpec = swaggerJSDoc(options);
