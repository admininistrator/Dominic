import apiClient, { API_PREFIX, getStoredAuthToken, refreshAuthSession } from "./apiClient";

// NOTE: `username` was a dormant adapter field that was never populated by any
// active call site (App.jsx sends session_id/message only). It has been removed
// from the public signature to keep the chat-send contract clean.
function buildChatPayload({
  session_id,
  message,
  knowledge_document_id,
  use_web_search,
  model,
  reasoning_effort,
  images,
  image_media_types,
}) {
  const payload = { session_id, message };
  if (knowledge_document_id) payload.knowledge_document_id = knowledge_document_id;
  if (use_web_search) payload.use_web_search = true;
  if (model) payload.model = model;
  if (reasoning_effort) payload.reasoning_effort = reasoning_effort;

  if (images && images.length > 0) {
    payload.images = images.map((img) => img.dataUri);
    payload.image_media_types = image_media_types || images.map((img) => img.type || "image/jpeg");
  }

  return payload;
}

function createApiError(detail, status = 500) {
  const message = typeof detail === "string" && detail.trim() ? detail.trim() : "Co loi khi goi API chat.";
  const error = new Error(message);
  error.response = {
    status,
    data: { detail: message },
  };
  return error;
}

async function readErrorDetail(response) {
  const rawText = await response.text();
  if (!rawText) {
    return response.statusText || "Yeu cau that bai.";
  }

  try {
    const parsed = JSON.parse(rawText);
    const detail = parsed?.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) return detail[0].msg;
  } catch {
    // Ignore JSON parse failure and fall back to raw text.
  }

  return rawText;
}

// Public pagination surface: { returned, hasMore, limit, beforeId, nextBeforeId }
// `skip` is no longer a public contract (CHAT-BE-003); it has been removed from
// both the request params and the parsed response to prevent any consumer from
// depending on it.
function parseMessagePaginationHeaders(headers, fallback = {}) {
  const getHeaderValue = (name) => headers?.[name.toLowerCase()] ?? headers?.[name] ?? null;
  const parseNumber = (value, nextFallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : nextFallback;
  };

  return {
    returned: parseNumber(getHeaderValue("x-message-pagination-returned"), fallback.returned ?? 0),
    hasMore: String(getHeaderValue("x-message-pagination-has-more") || "false").toLowerCase() === "true",
    limit: parseNumber(getHeaderValue("x-message-pagination-limit"), fallback.limit ?? null),
    beforeId: parseNumber(getHeaderValue("x-message-pagination-before-id"), fallback.beforeId ?? null),
    nextBeforeId: parseNumber(
      getHeaderValue("x-message-pagination-next-before-id"),
      fallback.nextBeforeId ?? null
    ),
  };
}

async function consumeSseStream(stream, onEvent) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload = null;

  const emitBlock = async (block) => {
    const lines = block.split(/\r?\n/);
    let eventName = "message";
    const dataLines = [];

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim() || "message";
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) return;

    let payload;
    const rawPayload = dataLines.join("\n");
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = { detail: rawPayload };
    }

    if (eventName === "error") {
      throw createApiError(payload?.detail, Number(payload?.status_code) || 500);
    }

    if (typeof onEvent === "function") {
      await onEvent({ event: eventName, data: payload });
    }

    if (eventName === "final") {
      finalPayload = payload;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || "";

    for (const part of parts) {
      await emitBlock(part);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    await emitBlock(buffer);
  }

  if (!finalPayload) {
    throw createApiError("Backend ket thuc stream truoc khi gui final event.", 502);
  }

  return finalPayload;
}

// sendChatMessage (sync Axios adapter) was removed – no caller existed in
// chatbot-ui/src after the streaming path became the sole live transport.
// The backend POST /api/v1/chat/ endpoint is still available; re-add this
// export only if a non-streaming consumer is intentionally introduced.

export async function sendChatMessageStream(payload, { signal, onEvent } = {}) {
  const baseUrl = apiClient.defaults.baseURL || window.location.origin;
  const url = new URL(`${API_PREFIX}/chat/stream`, baseUrl);
  const requestBody = JSON.stringify(buildChatPayload(payload));
  const headers = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  const authToken = getStoredAuthToken();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: requestBody,
    signal,
  });

  if (response.status === 401) {
    const session = await refreshAuthSession();
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...headers,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: requestBody,
      signal,
    });
  }

  if (!response.ok) {
    throw createApiError(await readErrorDetail(response), response.status);
  }

  if (!response.body) {
    throw createApiError("Backend khong tra ve luong du lieu stream.", response.status || 500);
  }

  return consumeSseStream(response.body, onEvent);
}


export async function getUsage() {
  const response = await apiClient.get(`${API_PREFIX}/chat/usage/me`);
  return response.data;
}


export async function createSession({ title }) {
  const response = await apiClient.post(`${API_PREFIX}/chat/sessions`, { title });
  return response.data;
}


export async function getSessions() {
  const response = await apiClient.get(`${API_PREFIX}/chat/sessions`);
  return response.data;
}


// Public cursor contract (CHAT-BE-003): only `before_id` and `limit` are sent.
// `skip` is no longer a public query param; omitting `limit` lets the backend
// apply its own default guarantee.
export async function getSessionMessages(sessionId, { limit, beforeId } = {}) {
  const params = {};
  if (typeof limit === "number") params.limit = limit;
  if (typeof beforeId === "number") params.before_id = beforeId;

  const response = await apiClient.get(`${API_PREFIX}/chat/sessions/${sessionId}/messages`, { params });
  return {
    items: response.data,
    pagination: parseMessagePaginationHeaders(response.headers, {
      returned: Array.isArray(response.data) ? response.data.length : 0,
      limit,
      beforeId,
    }),
  };
}


export async function deleteSession(sessionId) {
  await apiClient.delete(`${API_PREFIX}/chat/sessions/${sessionId}`);
}


export async function renameSession(sessionId, title) {
  const response = await apiClient.patch(`${API_PREFIX}/chat/sessions/${sessionId}`, { title });
  return response.data;
}


