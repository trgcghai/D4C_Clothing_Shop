import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CART_SERVICE_URL = process.env.CART_SERVICE_URL || "http://localhost:8084/api/v1";
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://localhost:8085/api/v1";

// 1. Function Declarations for Gemini
export const cartOrderToolDeclarations = [
  {
    name: "add_to_cart",
    description: "Add a specific product variant to the user's shopping cart.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "The unique ID of the product."
        },
        variantId: {
           type: "STRING",
           description: "The unique ID of the product variant (determines size and color)."
        },
        quantity: {
          type: "INTEGER",
          description: "Number of items to add. Defaults to 1 if not specified."
        }
      },
      required: ["productId", "variantId"]
    }
  },
  {
    name: "get_checkout_summary",
    description: "Get the current total price of the items in the user's cart.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  }
];

// 2. Executable Functions
// Note: userId will be injected dynamically by gemini.service.js
export const cartOrderToolHandlers = {
  add_to_cart: async (args, userId) => {
    try {
      if (!userId || userId === "anonymous") {
         return { error: "User must be logged in to add to cart." };
      }
      
      const { productId, variantId, quantity = 1 } = args;
      
      const payload = {
         userId,
         productId,
         variantId,
         quantity
      };

      const response = await axios.post(`${CART_SERVICE_URL}/cart/items`, payload);
      return { success: true, message: "Item added to cart successfully.", currentCartTotal: response.data.totalPrice || "N/A" };
    } catch (error) {
      console.error("Error in add_to_cart:", error.message);
      return { error: "Failed to add item to cart. Please ensure variant ID is valid." };
    }
  },

  get_checkout_summary: async (args, userId) => {
    try {
      if (!userId || userId === "anonymous") {
         return { error: "User must be logged in to view checkout summary." };
      }

      const response = await axios.get(`${CART_SERVICE_URL}/cart/${userId}`);
      
      if (response.data && response.data.data) {
        return {
           itemsCount: response.data.data.items?.length || 0,
           totalPrice: response.data.data.totalPrice || 0,
           currency: "VND"
        };
      }
      return { error: "Cart is empty or not found." };
    } catch (error) {
      console.error("Error in get_checkout_summary:", error.message);
      return { error: "Failed to fetch checkout summary." };
    }
  }
};
