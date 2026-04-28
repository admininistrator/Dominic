import { addDocument, isoNow } from "./state";
import { fulfillError, fulfillJson, fulfillNoContent } from "./http";

function extractUploadMetadata(request) {
  const payloadBuffer = request.postDataBuffer?.();
  if (!payloadBuffer) {
    return {
      filename: null,
      mimeType: null,
    };
  }

  const payloadText = Buffer.from(payloadBuffer).toString("latin1");
  const filenameMatch = payloadText.match(/filename="([^"]+)"/i);
  const contentTypeMatch = payloadText.match(/Content-Type:\s*([^\r\n;]+)/i);

  return {
    filename: filenameMatch?.[1] || null,
    mimeType: contentTypeMatch?.[1] || null,
  };
}

export async function handleKnowledgeRoute({ route, request, url, path, method, state }) {
  if (path === "/api/knowledge/documents" && method === "GET") {
    await fulfillJson(route, state.documents);
    return true;
  }

  if (path === "/api/knowledge/documents/upload" && method === "POST") {
    if (state.uploadFailure) {
      await fulfillError(route, state.uploadFailure.status || 422, state.uploadFailure.detail || "Upload tài liệu thất bại.");
      return true;
    }
    const sessionIdParam = url.searchParams.get("session_id");
    const uploadMetadata = extractUploadMetadata(request);
    const nextDocument = addDocument(state, {
      sessionId: sessionIdParam ? Number(sessionIdParam) : state.sessions[0]?.id ?? null,
      title: uploadMetadata.filename || undefined,
      sourceUri: uploadMetadata.filename || undefined,
      mimeType: uploadMetadata.mimeType || undefined,
    });
    await fulfillJson(
      route,
      {
        document_id: nextDocument.id,
        job_id: state.jobsByDocument[nextDocument.id][0].id,
        status: "indexed",
        chunks_count: state.chunksByDocument[nextDocument.id].length,
      },
      201,
    );
    return true;
  }

  if (path === "/api/knowledge/documents/ingest" && method === "POST") {
    if (state.ingestFailure) {
      await fulfillError(route, state.ingestFailure.status || 422, state.ingestFailure.detail || "Ingest text thất bại.");
      return true;
    }
    const payload = request.postDataJSON();
    const nextDocument = addDocument(state, {
      sessionId: payload.session_id ?? null,
      title: payload.title,
      sourceType: payload.source_type || "text",
      sourceUri: payload.source_uri || payload.title,
      mimeType: payload.mime_type || "text/plain",
      metadata: payload.metadata || { category: "ingest" },
      chunks: [payload.raw_text],
    });
    await fulfillJson(
      route,
      {
        document_id: nextDocument.id,
        job_id: state.jobsByDocument[nextDocument.id][0].id,
        status: "indexed",
        chunks_count: state.chunksByDocument[nextDocument.id].length,
      },
      201,
    );
    return true;
  }

  const chunksMatch = path.match(/^\/api\/knowledge\/documents\/(\d+)\/chunks$/);
  if (chunksMatch && method === "GET") {
    const documentId = Number(chunksMatch[1]);
    await fulfillJson(route, state.chunksByDocument[documentId] || []);
    return true;
  }

  const jobsMatch = path.match(/^\/api\/knowledge\/documents\/(\d+)\/jobs$/);
  if (jobsMatch && method === "GET") {
    const documentId = Number(jobsMatch[1]);
    await fulfillJson(route, state.jobsByDocument[documentId] || []);
    return true;
  }

  const reindexMatch = path.match(/^\/api\/knowledge\/documents\/(\d+)\/reindex$/);
  if (reindexMatch && method === "POST") {
    if (state.reindexFailure) {
      await fulfillError(route, state.reindexFailure.status || 422, state.reindexFailure.detail || "Reindex tài liệu thất bại.");
      return true;
    }
    const documentId = Number(reindexMatch[1]);
    const job = {
      id: state.nextJobId++,
      document_id: documentId,
      status: "completed",
      error_message: null,
      created_at: isoNow(),
      updated_at: isoNow(),
    };
    state.jobsByDocument[documentId] = [job, ...(state.jobsByDocument[documentId] || [])];
    await fulfillJson(route, {
      document_id: documentId,
      job_id: job.id,
      chunks_count: (state.chunksByDocument[documentId] || []).length,
      status: "indexed",
    });
    return true;
  }

  const deleteDocMatch = path.match(/^\/api\/knowledge\/documents\/(\d+)$/);
  if (deleteDocMatch && method === "DELETE") {
    if (state.deleteFailure) {
      await fulfillError(route, state.deleteFailure.status || 422, state.deleteFailure.detail || "Xóa tài liệu thất bại.");
      return true;
    }
    const documentId = Number(deleteDocMatch[1]);
    state.documents = state.documents.filter((document) => document.id !== documentId);
    delete state.chunksByDocument[documentId];
    delete state.jobsByDocument[documentId];
    state.searchResults = state.searchResults.filter((result) => result.document_id !== documentId);
    await fulfillNoContent(route);
    return true;
  }

  if (path === "/api/knowledge/search" && method === "POST") {
    if (state.searchFailure) {
      await fulfillError(route, state.searchFailure.status || 422, state.searchFailure.detail || "Search knowledge thất bại.");
      return true;
    }
    await fulfillJson(route, {
      query: request.postDataJSON()?.query || "refund policy",
      top_k: 5,
      returned: state.searchResults.length,
      retrieval_id: 501,
      strategy: "hybrid_rerank",
      fallback_used: false,
      evidence_strength: "grounded",
      query_expansions: ["refund policy"],
      results: state.searchResults,
    });
    return true;
  }

  return false;
}