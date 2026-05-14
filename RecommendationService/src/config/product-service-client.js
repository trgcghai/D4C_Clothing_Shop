import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const baseURL = process.env.PRODUCT_SERVICE_URL;

if (!baseURL) {
  throw new Error("PRODUCT_SERVICE_URL environment variable is not set");
}

let productServiceClient = axios.create({
  baseURL,
  timeout: 10000,
});

export { productServiceClient };
