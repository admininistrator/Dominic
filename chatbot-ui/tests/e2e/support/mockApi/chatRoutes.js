import { createSessionRecord, isoNow } from "./state";
import { fulfillJson, fulfillNoContent } from "./http";

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

function buildAssistantMeta(model = null, reasoningEffort = null) {
  const effectiveModel = model || "default model";
  const effectiveEffort = typeof reasoningEffort === "string" && reasoningEffort.trim() ? reasoningEffort.trim().toLowerCase() : null;
  return {
    model: effectiveModel,
    reasoning_effort: effectiveEffort,
    display_text: effectiveEffort ? `${effectiveModel} ${effectiveEffort}` : effectiveModel,
  };
}

function buildDefaultAssistantReply(state, sessionId, message, knowledgeDocumentId = null, useWebSearch = false, model = null, reasoningEffort = null) {
  const explicitDocument = knowledgeDocumentId
    ? state.documents.find((document) => document.id === knowledgeDocumentId) || null
    : null;
  const scopedDocument = state.documents.find((document) => document.session_id === sessionId) || null;
  const effectiveDocument = explicitDocument || scopedDocument;
  const source = effectiveDocument
    ? {
        document_id: effectiveDocument.id,
        chunk_id: Number(`${effectiveDocument.id}1`),
        rank: 1,
        title: effectiveDocument.title,
        score: 0.93,
        snippet: "Yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.",
      }
    : useWebSearch
      ? {
          document_id: null,
          chunk_id: null,
          rank: 1,
          title: "Tavily web result",
          source_type: "web",
          score: 0.88,
          snippet: `Web grounded reply via ${model || "default model"}.`,
          url: "https://example.com/web-search-result",
          domain: "example.com",
        }
      : null;

  return {
    reply: source?.source_type === "web"
      ? `Theo Tavily, tôi đang trả lời bằng ${model || "default model"}.`
      : "Theo Smoke Knowledge Base, yêu cầu hoàn tiền được xem xét trong vòng 5 ngày làm việc.",
    assistant_meta: buildAssistantMeta(model, reasoningEffort),
    sources: source ? [source] : [],
    retrieval: {
      used: Boolean(effectiveDocument),
      returned: source ? 1 : 0,
      document_id: effectiveDocument?.id ?? null,
      strategy: source?.source_type === "web" ? "web_search" : "hybrid_rerank",
      fallback_used: false,
      rewritten_query: message,
      query_expansions: ["refund policy"],
      evidence_strength: source?.source_type === "web" ? "web" : "grounded",
      answer_policy: source?.source_type === "web" ? "web_grounded" : "grounded",
      packed_count: effectiveDocument ? 1 : 0,
      packed_token_estimate: source ? 120 : 0,
      web_search_used: Boolean(useWebSearch),
      web_results_count: source?.source_type === "web" ? 1 : 0,
    },
    usage: {
      input_tokens: 120,
      output_tokens: 48,
    },
  };
}

export async function handleChatRoute({ route, request, path, method, state }) {
  if (path === "/api/chat/usage/me" && method === "GET") {
    await fulfillJson(route, state.usage);
    return true;
  }

  if (path === "/api/chat/sessions" && method === "GET") {
    await fulfillJson(route, state.sessions);
    return true;
  }

  if (path === "/api/chat/sessions" && method === "POST") {
    const nextSession = createSessionRecord({
      id: state.nextSessionId++,
      title: request.postDataJSON()?.title,
    });
    state.sessions = [nextSession, ...state.sessions];
    state.messagesBySession[nextSession.id] = [];
    await fulfillJson(route, nextSession);
    return true;
  }

  const sessionMessagesMatch = path.match(/^\/api\/chat\/sessions\/(\d+)\/messages$/);
  if (sessionMessagesMatch && method === "GET") {
    const sessionId = Number(sessionMessagesMatch[1]);
    await fulfillJson(route, state.messagesBySession[sessionId] || []);
    return true;
  }

  const sessionMutationMatch = path.match(/^\/api\/chat\/sessions\/(\d+)$/);
  if (sessionMutationMatch && method === "DELETE") {
    const sessionId = Number(sessionMutationMatch[1]);
    state.sessions = state.sessions.filter((session) => session.id !== sessionId);
    delete state.messagesBySession[sessionId];
    state.documents = state.documents.filter((document) => document.session_id !== sessionId);
    await fulfillNoContent(route);
    return true;
  }

  if (sessionMutationMatch && method === "PATCH") {
    const sessionId = Number(sessionMutationMatch[1]);
    const payload = request.postDataJSON();
    const session = state.sessions.find((row) => row.id === sessionId);
    if (session) {
      session.title = payload.title || session.title;
      session.updated_at = isoNow();
    }
    await fulfillJson(route, session || {});
    return true;
  }

  if (path === "/api/chat/" && method === "POST") {
    const payload = request.postDataJSON();
    const sessionId = Number(payload.session_id);
    const requestId = `req-${state.nextRequestId++}`;
    state.lastChatRequest = payload;
    const response = buildDefaultAssistantReply(
      state,
      sessionId,
      payload.message,
      payload.knowledge_document_id ?? null,
      Boolean(payload.use_web_search),
      payload.model ?? null,
      payload.reasoning_effort ?? null,
    );

    ensureSessionStore(state, sessionId);
    state.messagesBySession[sessionId] = [
      ...state.messagesBySession[sessionId],
      {
        id: state.nextMessageId++,
        role: "user",
        content: payload.message,
        request_id: requestId,
        created_at: isoNow(),
      },
      {
        id: state.nextMessageId++,
        role: "assistant",
        content: response.reply,
        request_id: requestId,
        created_at: isoNow(),
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        assistant_meta: response.assistant_meta,
        sources: response.sources,
        retrieval: response.retrieval,
      },
    ];
    touchSession(state, sessionId);

    await fulfillJson(route, {
      reply: response.reply,
      request_id: requestId,
      assistant_meta: response.assistant_meta,
      sources: response.sources,
      retrieval: response.retrieval,
      usage: response.usage,
    });
    return true;
  }

  return false;
}