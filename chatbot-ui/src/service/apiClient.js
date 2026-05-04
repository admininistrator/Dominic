import axios from "axios";

const DEFAULT_PRODUCTION_API_BASE_URL = "https://api.dominicapp.dev";
const AUTH_TOKEN_STORAGE_KEY = "dominic.authToken";
const REFRESH_TOKEN_STORAGE_KEY = "dominic.refreshToken";
export const API_PREFIX = "/api/v1";

function resolveBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");

  const hostname = window.location.hostname;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocalHost ? "http://127.0.0.1:8000" : DEFAULT_PRODUCTION_API_BASE_URL;
}

const baseURL = resolveBaseUrl();
const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 120000);
const REFRESH_PATH = `${API_PREFIX}/auth/refresh`;
const LOGIN_PATH = `${API_PREFIX}/auth/login`;
const REGISTER_PATH = `${API_PREFIX}/auth/register`;
const LOGOUT_PATH = `${API_PREFIX}/auth/logout`;

const apiClient = axios.create({
  baseURL,
  timeout: timeoutMs,
});

let refreshSessionPromise = null;

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

export function getStoredRefreshToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || "";
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

export function setRefreshToken(token) {
  const normalizedToken = (token || "").trim();
  if (typeof window !== "undefined") {
    if (normalizedToken) {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, normalizedToken);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
  }
}

export function setAuthSession(session = {}) {
  setAuthToken(session.access_token || "");
  setRefreshToken(session.refresh_token || "");
}

export async function refreshAuthSession() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearAuthSession();
    throw new Error("Missing refresh token.");
  }

  if (!refreshSessionPromise) {
    refreshSessionPromise = axios.post(
      `${baseURL}${REFRESH_PATH}`,
      { refresh_token: refreshToken },
      {
        timeout: timeoutMs,
        headers: { "Content-Type": "application/json" },
      },
    )
      .then((response) => {
        setAuthSession(response.data);
        return response.data;
      })
      .catch((error) => {
        clearAuthSession();
        throw error;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}

export function clearAuthToken() {
  setAuthToken("");
}

export function clearAuthSession() {
  setAuthSession({});
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;
    const requestUrl = typeof originalRequest?.url === "string" ? originalRequest.url : "";
    const isAuthRequest =
      requestUrl.includes(LOGIN_PATH) ||
      requestUrl.includes(REGISTER_PATH) ||
      requestUrl.includes(REFRESH_PATH) ||
      requestUrl.includes(LOGOUT_PATH);

    if (status !== 401 || !originalRequest || originalRequest._retry || isAuthRequest) {
      if (status === 401 && requestUrl.includes(REFRESH_PATH)) {
        clearAuthSession();
      }
      return Promise.reject(error);
    }

    if (!getStoredRefreshToken()) {
      clearAuthSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const session = await refreshAuthSession();
      originalRequest.headers = {
        ...(originalRequest.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
      };
      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

setAuthToken(getStoredAuthToken());
setRefreshToken(getStoredRefreshToken());

export default apiClient;
