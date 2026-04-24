import apiClient from "./apiClient";

export async function sendChatMessage({
  username,
  session_id,
  message,
  knowledge_document_id,
  images,          // [{dataUri, type}] – optional
  image_media_types, // [string] – optional
}) {
  const payload = { session_id, message };
  if (username) payload.username = username;
  if (knowledge_document_id) payload.knowledge_document_id = knowledge_document_id;

  // Attach vision images when present
  if (images && images.length > 0) {
    payload.images = images.map((img) => img.dataUri);
    payload.image_media_types = image_media_types || images.map((img) => img.type || "image/jpeg");
  }

  const response = await apiClient.post("/api/chat/", payload);
  return response.data;
}


export async function getUsage() {
  const response = await apiClient.get("/api/chat/usage/me");
  return response.data;
}


export async function createSession({ title }) {
  const response = await apiClient.post("/api/chat/sessions", { title });
  return response.data;
}


export async function getSessions() {
  const response = await apiClient.get("/api/chat/sessions");
  return response.data;
}


export async function getSessionMessages(sessionId) {
  const response = await apiClient.get(`/api/chat/sessions/${sessionId}/messages`);
  return response.data;
}


export async function deleteSession(sessionId) {
  await apiClient.delete(`/api/chat/sessions/${sessionId}`);
}


export async function renameSession(sessionId, title) {
  const response = await apiClient.patch(`/api/chat/sessions/${sessionId}`, { title });
  return response.data;
}


