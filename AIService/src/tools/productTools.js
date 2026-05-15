import { productServiceClient } from "../config/service-urls.js";

// 1. Function Declarations for Gemini
export const productToolDeclarations = [
  {
    name: "search_products",
    description: "Search for products by keyword, category, or filter criteria.",
    parameters: {
      type: "OBJECT",
      properties: {
        keyword: {
          type: "STRING",
          description: "Keyword to search for in product name or description."
        },
        category: {
          type: "STRING",
          description: "Category ID to filter by."
        },
        maxPrice: {
          type: "NUMBER",
          description: "Maximum price filter."
        }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Get detailed information about a specific product including available sizes and colors.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "The unique ID of the product."
        }
      },
      required: ["productId"]
    }
  }
];

// 2. Executable Functions — always return plain objects (not arrays)
export const productToolHandlers = {
  search_products: async (args) => {
    try {
      const { keyword, category, maxPrice } = args;

      let response;

      if (keyword) {
        // ✅ Use the dedicated search endpoint that does proper keyword filtering
        const params = { q: keyword, limit: 5 };
        if (maxPrice) params.maxPrice = maxPrice;
        response = await productServiceClient.get("/search", { params });
      } else {
        // Fallback to filter endpoint for category/price-only queries
        const params = {};
        if (category) params.category = category;
        if (maxPrice) params.maxPrice = maxPrice;
        params.limit = 5;
        response = await productServiceClient.get("/", { params });
      }

      if (response.data && response.data.data) {
        const products = response.data.data
          .slice(0, 5)
          .map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            brand: p.brand,
            category: p.category?.name || p.category || null,
            image: p.imageUrl || p.image || null
          }));
        return { products, count: products.length };
      }
      return { products: [], count: 0, message: "No products found." };
    } catch (error) {
      console.error("Error in search_products:", error.message);
      return { error: "Failed to search products." };
    }
  },

  get_product_details: async (args) => {
    try {
      const { productId } = args;
      const response = await productServiceClient.get(`/${productId}`);

      if (response.data && response.data.data) {
        const p = response.data.data;
        // Slim down variants — only return what AI needs
        const variants = (p.variants || []).slice(0, 10).map(v => ({
          id: v.id,
          size: v.size,
          color: v.color,
          stock: v.stockQuantity,
          price: v.price || p.price
        }));
        return {
          id: p.id,
          name: p.name,
          description: p.description?.substring(0, 200) || null,
          price: p.price,
          variants
        };
      }
      return { error: "Product not found." };
    } catch (error) {
      console.error("Error in get_product_details:", error.message);
      return { error: "Failed to fetch product details." };
    }
  }
};
