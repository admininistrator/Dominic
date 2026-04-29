const DEFAULT_USER = {
  username: "test_user",
  role: "user",
};

export function isoNow() {
  return new Date("2026-04-28T09:30:00.000Z").toISOString();
}

export function createSessionRecord({ id, title, created_at, updated_at } = {}) {
  const sessionId = id ?? 101;
  const now = isoNow();
  return {
    id: sessionId,
    title: title ?? `Chat ${Math.max(1, sessionId - 100)}`,
    created_at: created_at ?? now,
    updated_at: updated_at ?? now,
  };
}

export function createApiState({
  user = DEFAULT_USER,
  sessions,
  uploadFailure = null,
  searchFailure = null,
  ingestFailure = null,
  reindexFailure = null,
  deleteFailure = null,
} = {}) {
  const safeSessions = Array.isArray(sessions) && sessions.length > 0 ? sessions : [createSessionRecord()];
  const nextSessionId = Math.max(...safeSessions.map((session) => session.id), 100) + 1;

  return {
    token: "smoke-token",
    user: {
      role: "user",
      ...user,
    },
    sessions: safeSessions.map((session) => ({ ...session })),
    messagesBySession: Object.fromEntries(safeSessions.map((session) => [session.id, []])),
    documents: [],
    chunksByDocument: {},
    jobsByDocument: {},
    searchResults: [],
    usage: {
      username: user.username || DEFAULT_USER.username,
      max_tokens_per_day: 10000,
      total_token_used: 320,
      total_input_tokens_used: 120,
      total_output_tokens_used: 200,
      lifetime_total_token_used: 320,
      lifetime_total_input_tokens_used: 120,
      lifetime_total_output_tokens_used: 200,
      rolling_window_hours: 2,
      rolling_total_token_used: 320,
      rolling_input_tokens_used: 120,
      rolling_output_tokens_used: 200,
    },
    resetCalls: [],
    uploadFailure,
    searchFailure,
    ingestFailure,
    reindexFailure,
    deleteFailure,
    lastChatRequest: null,
    nextSessionId,
    nextDocumentId: 1,
    nextJobId: 1,
    nextMessageId: 1,
    nextRequestId: 1,
  };
}

function ensureSessionStore(state, sessionId) {
  if (!state.messagesBySession[sessionId]) {
    state.messagesBySession[sessionId] = [];
  }
}

function touchSession(state, sessionId) {
  const session = state.sessions.find((row) => row.id === sessionId);
  if (!session) return;
  session.updated_at = isoNow();
}

function buildChunk(documentId, chunkIndex, chunkInput) {
  const content = typeof chunkInput === "string" ? chunkInput : chunkInput.content;
  return {
    id: Number(`${documentId}${chunkIndex}`),
    document_id: documentId,
    chunk_index: chunkIndex,
    content,
    token_count: typeof chunkInput === "object" ? Number(chunkInput.token_count || 24) : 24,
    embedding_model: "local-hash-v1",
    vector_id: `vector-${documentId}-${chunkIndex}`,
    metadata_json: { char_count: content.length },
    created_at: isoNow(),
  };
}

export function addConversation(
  state,
  sessionId,
  { userContent, assistantContent, requestId, sources = [], retrieval = null }
) {
  ensureSessionStore(state, sessionId);
  const effectiveRequestId = requestId ?? `seed-${state.nextRequestId++}`;

  if (userContent) {
    state.messagesBySession[sessionId].push({
      id: state.nextMessageId++,
      role: "user",
      content: userContent,
      request_id: effectiveRequestId,
      created_at: isoNow(),
    });
  }

  if (assistantContent) {
    state.messagesBySession[sessionId].push({
      id: state.nextMessageId++,
      role: "assistant",
      content: assistantContent,
      request_id: effectiveRequestId,
      created_at: isoNow(),
      input_tokens: 120,
      output_tokens: 48,
      sources,
      retrieval,
    });
  }

  touchSession(state, sessionId);
  return effectiveRequestId;
}

export function addDocument(
  state,
  {
    sessionId = null,
    title = "smoke-upload.txt",
    sourceType = "upload",
    sourceUri = title,
    mimeType = "text/plain",
    metadata = { category: "smoke" },
    chunks = [
      "Yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.",
      "Khách hàng có thể nộp minh chứng trên cổng hỗ trợ.",
    ],
  } = {}
) {
  const documentId = state.nextDocumentId++;
  const now = isoNow();
  const document = {
    id: documentId,
    owner_username: state.user.username,
    title,
    source_type: sourceType,
    source_uri: sourceUri,
    mime_type: mimeType,
    status: "indexed",
    checksum: `checksum-${documentId}`,
    session_id: sessionId,
    metadata_json: metadata,
    created_at: now,
    updated_at: now,
  };

  state.documents = [document, ...state.documents];
  state.chunksByDocument[documentId] = chunks.map((chunk, index) => buildChunk(documentId, index + 1, chunk));
  state.jobsByDocument[documentId] = [
    {
      id: state.nextJobId++,
      document_id: documentId,
      status: "completed",
      error_message: null,
      created_at: now,
      updated_at: now,
    },
  ];
  return document;
}

export function createSearchResult({ document, chunkIndex = 1, snippet, score = 0.93 }) {
  return {
    document_id: document.id,
    chunk_id: Number(`${document.id}${chunkIndex}`),
    title: document.title,
    score,
    snippet: snippet ?? "Yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.",
  };
}