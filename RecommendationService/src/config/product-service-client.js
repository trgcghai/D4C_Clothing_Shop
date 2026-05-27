import axios from "axios";
import eurekaClient from "./eureka.config.js";

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

const productServiceClient = axios.create({
  timeout: 10000,
});

productServiceClient.interceptors.request.use((config) => {
  const baseUrl = getBaseUrl();
  config.url = baseUrl + config.url;
  return config;
});

export { productServiceClient };
