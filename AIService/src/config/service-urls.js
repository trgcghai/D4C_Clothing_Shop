import { createServiceClient } from "./service-discovery.js";

// Each client resolves URLs via Eureka at request time, with .env fallback
export const productServiceClient = createServiceClient("ProductService", "/api/products");
export const cartServiceClient = createServiceClient("CartService", "/api/v1");
export const orderServiceClient = createServiceClient("ORDERSERVICE", "/api/v1");
export const notificationServiceClient = createServiceClient("NotificationService", "/api/v1");
export const recommendationServiceClient = createServiceClient("RecommendationService", "/api/v1");
