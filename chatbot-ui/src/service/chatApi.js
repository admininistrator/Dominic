import apiClient from "./apiClient";

export async function sendChatMessage({ username, message }) {
  const response = await apiClient.post("/api/chat/", {
    username,
    message,
  });
  return response.data;
}


export async function login({ username, password }) {
  const response = await apiClient.post("/api/chat/login", {
    username,
    password,
  });
  return response.data;
}


export async function getUsage(username) {
  const response = await apiClient.get(`/api/chat/usage/${encodeURIComponent(username)}`);
  return response.data;
}

