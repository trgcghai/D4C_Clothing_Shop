import axios from "axios";

export const productServiceClient = axios.create({
  baseURL: process.env.PRODUCT_SERVICE_URL || "http://productservice:8082",
  timeout: 10000,
});
