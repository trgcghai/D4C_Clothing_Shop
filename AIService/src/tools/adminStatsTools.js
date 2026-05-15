import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://orderservice:8085/api/v1";
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://productservice:8082/api/v1";

export const adminStatsToolDeclarations = [
  {
    name: "get_revenue_stats",
    description: "Get revenue statistics for a specific period.",
    parameters: {
      type: "OBJECT",
      properties: {
        period: {
          type: "STRING",
          description: "The period to check revenue for: 'today', 'this_week', 'this_month'. Default is 'today'."
        }
      }
    }
  },
  {
    name: "get_low_inventory_report",
    description: "Get a list of products or variants that have low stock and need restocking.",
    parameters: {
      type: "OBJECT",
      properties: {
        threshold: {
          type: "INTEGER",
          description: "Stock quantity threshold. Default is 5."
        }
      }
    }
  },
  {
    name: "create_product",
    description: "Create a new product in the store (Admin only).",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Name of the product" },
        price: { type: "NUMBER", description: "Base price of the product" },
        description: { type: "STRING", description: "Product description" },
        brand: { type: "STRING", description: "Brand name" },
        categoryName: { type: "STRING", description: "Category name (e.g., 'Shirts', 'Shoes')" }
      },
      required: ["name", "price", "categoryName"]
    }
  },
  {
    name: "delete_product",
    description: "Delete a product by its ID (Admin only).",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: { type: "STRING", description: "The ID of the product to delete" }
      },
      required: ["productId"]
    }
  }
];

export const adminStatsToolHandlers = {
  get_revenue_stats: async (args) => {
    try {
      const { period = 'today' } = args;
      const response = await axios.get(`${ORDER_SERVICE_URL}/orders/stats/revenue?period=${period}`);

      if (response.data && response.data.data) {
        const data = response.data.data;
        // Ensure it's always a plain object
        if (typeof data === 'object' && !Array.isArray(data)) {
          return { period, ...data };
        }
        return { period, result: data };
      }
      // Fallback simulated data
      return { period, totalRevenue: 15000000, ordersCount: 42, currency: "VND", note: "Simulated data" };
    } catch (error) {
      console.error("Error fetching revenue stats:", error.message);
      // Return simulated data on error so AI can still respond
      const { period = 'today' } = args;
      return { period, totalRevenue: 0, ordersCount: 0, currency: "VND", note: "Stats endpoint unavailable." };
    }
  },

  get_low_inventory_report: async (args) => {
    try {
      const threshold = args.threshold || 5;
      const PRODUCT_API_BASE = `${PRODUCT_SERVICE_URL.replace('/api/v1', '')}/api/products`;
      const response = await axios.get(`${PRODUCT_API_BASE}`);

      if (response.data && response.data.data) {
        const allProducts = response.data.data;
        const lowStockItems = [];

        allProducts.forEach(product => {
          if (product.variants) {
            product.variants.forEach(variant => {
              if (variant.stockQuantity <= threshold) {
                lowStockItems.push({
                  productId: product.id,
                  productName: product.name,
                  variantId: variant.id,
                  size: variant.size,
                  color: variant.color,
                  currentStock: variant.stockQuantity
                });
              }
            });
          }
        });

        // Always return plain object with items array inside
        return {
          threshold,
          count: lowStockItems.length,
          items: lowStockItems.slice(0, 10) // top 10 only
        };
      }
      return { threshold, count: 0, items: [], message: "No inventory data found." };
    } catch (error) {
      console.error("Error fetching inventory report:", error.message);
      return { error: "Failed to fetch inventory report." };
    }
  },

  create_product: async (args) => {
    try {
      const PRODUCT_API_BASE = `${PRODUCT_SERVICE_URL.replace('/api/v1', '')}/api/products`;
      const response = await axios.post(`${PRODUCT_API_BASE}`, args);
      return { success: true, message: `Sản phẩm '${args.name}' đã được tạo thành công.`, productId: response.data.id };
    } catch (error) {
      console.error("Error creating product:", error.response?.data || error.message);
      return { success: false, error: "Không thể tạo sản phẩm. Vui lòng kiểm tra lại thông tin." };
    }
  },

  delete_product: async (args) => {
    try {
      const { productId } = args;
      const PRODUCT_API_BASE = `${PRODUCT_SERVICE_URL.replace('/api/v1', '')}/api/products`;
      await axios.delete(`${PRODUCT_API_BASE}/${productId}`);
      return { success: true, message: `Đã xóa sản phẩm ID: ${productId} thành công.` };
    } catch (error) {
      console.error("Error deleting product:", error.message);
      return { success: false, error: "Lỗi khi xóa sản phẩm. Có thể sản phẩm không tồn tại hoặc có ràng buộc dữ liệu." };
    }
  }
};
