import { notificationServiceClient, recommendationServiceClient } from "../config/service-urls.js";

export const socialToolDeclarations = [
  {
    name: "get_notification_summary",
    description: "Get recent notifications for the user, such as order updates, promotions, or system alerts.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "INTEGER",
          description: "Number of recent notifications to retrieve. Default is 5."
        }
      }
    }
  },
  {
    name: "get_personalized_recommendations",
    description: "Get product recommendations tailored specifically for the user based on their history.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "INTEGER",
          description: "Number of recommendations to retrieve."
        }
      }
    }
  }
];

export const socialToolHandlers = {
  get_notification_summary: async (args, userId) => {
    try {
      if (!userId || userId === "anonymous") return { error: "User must be logged in to check notifications." };

      const limit = Math.min(args.limit || 5, 5); // cap at 5
      const response = await notificationServiceClient.get(`/notifications/user/${userId}`);

      if (response.data && response.data.data) {
        const notifications = response.data.data.slice(0, limit).map(n => ({
          id: n.id,
          title: n.title,
          message: n.message?.substring(0, 100) || null,
          isRead: n.isRead,
          createdAt: n.createdAt
        }));
        // Always return object, never array
        return { notifications, count: notifications.length };
      }
      return { notifications: [], count: 0, message: "No notifications found." };
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      return { error: "Failed to fetch notifications." };
    }
  },

  get_personalized_recommendations: async (args, userId) => {
    try {
      if (!userId || userId === "anonymous") return { error: "User must be logged in for personalized recommendations." };

      const limit = Math.min(args.limit || 5, 5); // cap at 5
      const response = await recommendationServiceClient.get(`/recommendations/${userId}`);

      if (response.data && response.data.data) {
        const raw = Array.isArray(response.data.data)
          ? response.data.data
          : [response.data.data];
        const recommendations = raw.slice(0, limit).map(r => ({
          id: r.id || r.productId,
          name: r.name || r.productName,
          price: r.price,
          reason: r.reason || null
        }));
        // Always return object, never array
        return { recommendations, count: recommendations.length };
      }
      return { recommendations: [], count: 0, message: "No specific recommendations at this time." };
    } catch (error) {
      console.error("Error fetching recommendations:", error.message);
      return { error: "Failed to fetch recommendations." };
    }
  }
};
