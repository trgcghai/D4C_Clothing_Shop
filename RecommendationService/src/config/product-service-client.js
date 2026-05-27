import axios from "axios";
import eurekaClient from "./eureka.config.js";
import CircuitBreaker from "opossum";

let currentIndex = 0;

function getBaseUrl() {
  const instances = eurekaClient.getInstancesByAppId("ProductService");

  if (!instances || instances.length === 0) {
    const fallback = process.env.PRODUCT_SERVICE_URL;
    if (fallback) return fallback;
    throw new Error("ProductService not found in Eureka and no PRODUCT_SERVICE_URL fallback");
  }

  const instance = instances[currentIndex % instances.length];
  currentIndex++;

  return `http://${instance.hostName}:${instance.port.$}`;
}

const axiosInstance = axios.create({ timeout: 10000 });

axiosInstance.interceptors.request.use((config) => {
  const baseUrl = getBaseUrl();
  config.url = baseUrl + config.url;
  return config;
});

const circuitBreaker = new CircuitBreaker(
  async (config) => {
    return await axiosInstance(config);
  },
  {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    name: "ProductService"
  }
);

circuitBreaker.fallback(() => null);

circuitBreaker.on("open", () => console.warn("[CB] ProductService circuit opened"));
circuitBreaker.on("close", () => console.info("[CB] ProductService circuit closed"));
circuitBreaker.on("reject", () => console.warn("[CB] Call rejected for ProductService (circuit open)"));
circuitBreaker.on("fallback", () => console.warn("[CB] Fallback invoked for ProductService"));

export function getProductServiceClient() {
  return {
    get: (url, config = {}) => circuitBreaker.fire({ method: "get", url, ...config }),
  };
}

export function getCircuitBreakerStats() {
  return circuitBreaker.stats;
}

export { circuitBreaker };
