import axios from "axios";

const DEFAULT_PRODUCTION_API_BASE_URL = "https://api.dominicapp.dev";
const AUTH_TOKEN_STORAGE_KEY = "dominic.authToken";

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
});

apiClient.interceptors.request.use((config) => {
  const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;

  if (isFormData) {
    if (typeof config.headers?.setContentType === "function") {
      config.headers.setContentType(undefined);
    } else if (config.headers) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
    return config;
  }

  const isPlainObjectPayload =
    config.data &&
    typeof config.data === "object" &&
    !(config.data instanceof URLSearchParams) &&
    !(typeof Blob !== "undefined" && config.data instanceof Blob) &&
    !(typeof ArrayBuffer !== "undefined" && config.data instanceof ArrayBuffer);

  if (isPlainObjectPayload) {
    if (typeof config.headers?.setContentType === "function") {
      config.headers.setContentType("application/json");
    } else {
      config.headers = {
        ...config.headers,
        "Content-Type": "application/json",
      };
    }
  }

  return config;
});

export function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
}

export function setAuthToken(token) {
  const normalizedToken = (token || "").trim();
  if (typeof window !== "undefined") {
    if (normalizedToken) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalizedToken);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }

  if (normalizedToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${normalizedToken}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

export function clearAuthToken() {
  setAuthToken("");
}

setAuthToken(getStoredAuthToken());

export default apiClient;
