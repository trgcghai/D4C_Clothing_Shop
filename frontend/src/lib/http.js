import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;

let http;

try {
  if (!baseURL) {
    throw new Error(
      "API base URL is not defined. Please set VITE_API_URL in your environment variables.",
    );
  }

  http = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      Accept: "application/json",
    },
  });
} catch (error) {
  console.error("Failed to create HTTP client:", error);
}

export default http;
