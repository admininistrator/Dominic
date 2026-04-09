import apiClient from "./apiClient";

export async function sendChatMessage({ username, session_id, message }) {
  const response = await apiClient.post("/api/chat/", {
    username,
    session_id,
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


export async function createSession({ username, title }) {
  const response = await apiClient.post("/api/chat/sessions", { username, title });
  return response.data;
}


export async function getSessions(username) {
  const response = await apiClient.get(`/api/chat/sessions/${encodeURIComponent(username)}`);
  return response.data;
}


export async function getSessionMessages(username, sessionId) {
  const response = await apiClient.get(
    `/api/chat/sessions/${encodeURIComponent(username)}/${sessionId}/messages`
  );
  return response.data;
}


