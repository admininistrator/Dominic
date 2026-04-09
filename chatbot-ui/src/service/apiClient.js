import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 120000);

const apiClient = axios.create({
  baseURL,
  timeout: timeoutMs,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
