import apiClient from "./apiClient";

export async function uploadKnowledgeFile(file, { asyncIndex = false } = {}) {
  const formData = new FormData();
  formData.append("file", file, file?.name || "upload.bin");

  const response = await apiClient.post("/api/knowledge/documents/upload", formData, {
    params: asyncIndex ? { async_index: true } : {},
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
}) {
  const response = await apiClient.post(
    "/api/knowledge/documents/ingest",
    { title, raw_text, source_type, source_uri, mime_type, metadata },
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

export async function listKnowledgeDocuments({ skip = 0, limit = 50 } = {}) {
  const response = await apiClient.get("/api/knowledge/documents", {
    params: { skip, limit },
  });
  return response.data;
}

export async function getKnowledgeDocument(docId) {
  const response = await apiClient.get(`/api/knowledge/documents/${docId}`);
  return response.data;
}

export async function getKnowledgeChunks(docId) {
  const response = await apiClient.get(`/api/knowledge/documents/${docId}/chunks`);
  return response.data;
}

export async function getKnowledgeJobs(docId) {
  const response = await apiClient.get(`/api/knowledge/documents/${docId}/jobs`);
  return response.data;
}

export async function searchKnowledge({ query, top_k, document_id }) {
  const response = await apiClient.post("/api/knowledge/search", {
    query,
    top_k,
    document_id,
  });
  return response.data;
}

export async function getKnowledgeAnalytics({ username, recent_limit = 20 } = {}) {
  const response = await apiClient.get("/api/knowledge/admin/analytics", {
    params: {
      username,
      recent_limit,
    },
  });
  return response.data;
}

export async function reindexKnowledgeDocument(docId) {
  const response = await apiClient.post(`/api/knowledge/documents/${docId}/reindex`);
  return response.data;
}

export async function deleteKnowledgeDocument(docId) {
  const response = await apiClient.delete(`/api/knowledge/documents/${docId}`);
  return response.data;
}

export async function getKnowledgeJob(jobId) {
  const response = await apiClient.get(`/api/knowledge/jobs/${jobId}`);
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
  const response = await apiClient.get("/api/knowledge/admin/audit-logs", {
    params: { actor_username, action, resource_type, resource_id, skip, limit },
  });
  return response.data;
}

export async function getCostMetrics({ username } = {}) {
  const response = await apiClient.get("/api/knowledge/admin/cost", {
    params: username ? { username } : {},
  });
  return response.data;
}
