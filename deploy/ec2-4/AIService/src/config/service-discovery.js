import axios from "axios";
import eurekaClient from "./eureka.config.js";

// Fallback URLs from environment variables
const FALLBACK_URLS = {
  ProductService: process.env.PRODUCT_SERVICE_URL,
  CartService: process.env.CART_SERVICE_URL,
  ORDERSERVICE: process.env.ORDER_SERVICE_URL,
  NotificationService: process.env.NOTIFICATION_SERVICE_URL,
  RecommendationService: process.env.RECOMMENDATION_SERVICE_URL,
};

// Round-robin index per service
const serviceIndexes = {};

/**
 * Resolve service base URL from Eureka, fallback to env.
 * @param {string} appName - Eureka app name (e.g. "ProductService")
 * @returns {string} Base URL without trailing slash
 */
function resolveServiceUrl(appName) {
  const instances = eurekaClient.getInstancesByAppId(appName);

  if (!instances || instances.length === 0) {
    const fallback = FALLBACK_URLS[appName];
    if (fallback) {
      // Strip path suffix (e.g. "/api/v1") to get base URL
      return fallback.replace(/\/api\/v1$/, "");
    }
    throw new Error(`${appName} not found in Eureka and no fallback URL configured`);
  }

  if (!serviceIndexes[appName]) {
    serviceIndexes[appName] = 0;
  }

  const instance = instances[serviceIndexes[appName] % instances.length];
  serviceIndexes[appName]++;

  return `http://${instance.hostName}:${instance.port.$}`;
}

/**
 * Create an axios client that resolves service URLs via Eureka at request time.
 * @param {string} appName - Eureka app name
 * @param {string} [basePath=""] - Base path to prepend (e.g. "/api/v1")
 * @returns {import("axios").AxiosInstance}
 */
export function createServiceClient(appName, basePath = "") {
  const client = axios.create({ timeout: 10000 });

  client.interceptors.request.use((config) => {
    const baseUrl = resolveServiceUrl(appName);
    config.url = baseUrl + basePath + config.url;
    return config;
  });

  return client;
}
