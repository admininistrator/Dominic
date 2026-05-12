import apiClient, { API_PREFIX } from "./apiClient";

// FE contract: upload is synchronous-only. The backend always indexes inline
// before responding. Do NOT add async_index or poll flows here — the FE has
// no async indexing path and the backend vocabulary is locked to sync status.
export async function uploadKnowledgeFile(file, { sessionId = null } = {}) {
  const formData = new FormData();
  formData.append("file", file, file?.name || "upload.bin");

  const params = {};
  if (sessionId) params.session_id = sessionId;

  const response = await apiClient.post(`${API_PREFIX}/knowledge/documents/upload`, formData, {
    params,
  });
  return response.data;
}

// FE contract: ingest is synchronous-only. Do NOT add asyncIndex or async_index
// param — the FE has no async indexing path and no poll flow is wired.
export async function ingestKnowledgeText({
  title,
  raw_text,
  source_type = "text",
  source_uri,
  mime_type,
  metadata,
  session_id,
}) {
  const response = await apiClient.post(
    `${API_PREFIX}/knowledge/documents/ingest`,
    { title, raw_text, source_type, source_uri, mime_type, metadata, session_id },
  );
  return response.data;
}

export async function listKnowledgeDocuments({ skip = 0, limit = 50, sessionId = null, sessionFilter = "all" } = {}) {
  const params = { skip, limit };
  if (sessionId) params.session_id = sessionId;
  if (sessionFilter !== "all") params.session_filter = sessionFilter;

  const response = await apiClient.get(`${API_PREFIX}/knowledge/documents`, { params });
  return response.data;
}

// getKnowledgeDocument(docId) was removed — no live caller existed in the FE
// after the knowledge panel switched to list+detail loading via
// listKnowledgeDocuments + getKnowledgeChunks/getKnowledgeJobs.
// Re-add only if a single-document fetch is intentionally introduced.

export async function getKnowledgeChunks(docId) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/documents/${docId}/chunks`);
  return response.data;
}

export async function getKnowledgeJobs(docId) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/documents/${docId}/jobs`);
  return response.data;
}

// Panel search is always owner-wide: only query and top_k are sent.
// Do NOT add session_id, scope, or document_id here.
export async function searchKnowledge({ query, top_k }) {
  const response = await apiClient.post(`${API_PREFIX}/knowledge/search`, {
    query,
    top_k,
  });
  return response.data;
}

export async function getKnowledgeAnalytics({ username, recent_limit = 20 } = {}) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/admin/analytics`, {
    params: {
      username,
      recent_limit,
    },
  });
  return response.data;
}

export async function reindexKnowledgeDocument(docId) {
  const response = await apiClient.post(`${API_PREFIX}/knowledge/documents/${docId}/reindex`);
  return response.data;
}

export async function deleteKnowledgeDocument(docId) {
  const response = await apiClient.delete(`${API_PREFIX}/knowledge/documents/${docId}`);
  return response.data;
}

// getKnowledgeJob(jobId) was removed — its only caller was pollJobUntilDone,
// which was removed when the async indexing flow was locked out of the FE.
// Re-add only if a job-status polling flow is intentionally introduced.

export async function getAuditLogs({
  actor_username,
  action,
  resource_type,
  resource_id,
  skip = 0,
  limit = 100,
} = {}) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/admin/audit-logs`, {
    params: { actor_username, action, resource_type, resource_id, skip, limit },
  });
  return response.data;
}

export async function getCostMetrics({ username } = {}) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/admin/cost`, {
    params: username ? { username } : {},
  });
  return response.data;
}
