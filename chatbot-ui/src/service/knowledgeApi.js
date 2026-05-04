import apiClient, { API_PREFIX } from "./apiClient";

export async function uploadKnowledgeFile(file, { asyncIndex = false, sessionId = null } = {}) {
  const formData = new FormData();
  formData.append("file", file, file?.name || "upload.bin");

  const params = {};
  if (asyncIndex) params.async_index = true;
  if (sessionId) params.session_id = sessionId;

  const response = await apiClient.post(`${API_PREFIX}/knowledge/documents/upload`, formData, {
    params,
  });
  return response.data;
}

export async function ingestKnowledgeText({
  title,
  raw_text,
  source_type = "text",
  source_uri,
  mime_type,
  metadata,
  asyncIndex = false,
  session_id,
}) {
  const response = await apiClient.post(
    `${API_PREFIX}/knowledge/documents/ingest`,
    { title, raw_text, source_type, source_uri, mime_type, metadata, session_id },
    { params: asyncIndex ? { async_index: true } : {} },
  );
  return response.data;
}

export async function pollJobUntilDone(jobId, { intervalMs = 1500, maxWaitMs = 60000, onStatus } = {}) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const job = await getKnowledgeJob(jobId);
    if (onStatus) onStatus(job);
    if (job.status === "completed" || job.status === "indexed" || job.status === "failed") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Job ${jobId} did not finish within ${maxWaitMs / 1000}s`);
}

export async function listKnowledgeDocuments({ skip = 0, limit = 50, sessionId = null, sessionFilter = "all" } = {}) {
  const params = { skip, limit };
  if (sessionId) params.session_id = sessionId;
  if (sessionFilter !== "all") params.session_filter = sessionFilter;

  const response = await apiClient.get(`${API_PREFIX}/knowledge/documents`, { params });
  return response.data;
}

export async function getKnowledgeDocument(docId) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/documents/${docId}`);
  return response.data;
}

export async function getKnowledgeChunks(docId) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/documents/${docId}/chunks`);
  return response.data;
}

export async function getKnowledgeJobs(docId) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/documents/${docId}/jobs`);
  return response.data;
}

export async function searchKnowledge({ query, top_k, document_id }) {
  const response = await apiClient.post(`${API_PREFIX}/knowledge/search`, {
    query,
    top_k,
    document_id,
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

export async function getKnowledgeJob(jobId) {
  const response = await apiClient.get(`${API_PREFIX}/knowledge/jobs/${jobId}`);
  return response.data;
}

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
