import axios from "axios";

const DEFAULT_PRODUCTION_API_BASE_URL = "https://api.dominicapp.dev";

function resolveBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");

  const hostname = window.location.hostname;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocalHost ? "http://127.0.0.1:8000" : DEFAULT_PRODUCTION_API_BASE_URL;
}

const baseURL = resolveBaseUrl();
const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 120000);

const apiClient = axios.create({
  baseURL,
  timeout: timeoutMs,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
