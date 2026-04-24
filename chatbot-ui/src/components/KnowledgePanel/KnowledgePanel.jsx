import { useMemo, useRef, useState } from "react";
import styles from "./KnowledgePanel.module.css";
import { formatDate } from "../../utils/formatters";

export default function KnowledgePanel({
  documents,
  selectedDocumentId,
  chunks,
  jobs,
  searchState,
  isLoading,
  onSelectDocument,
  onRefreshDocuments,
  onUploadFile,
  onIngestText,
  onSearchKnowledge,
  onReindexDocument,
  onDeleteDocument,
}) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [sourceUri, setSourceUri] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTopK, setSearchTopK] = useState(5);
  const [searchScope, setSearchScope] = useState("all");
  const [feedback, setFeedback] = useState({ type: "info", text: "" });
  const [asyncMode, setAsyncMode] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const safeDocuments = useMemo(() => (Array.isArray(documents) ? documents : []), [documents]);
  const safeChunks = useMemo(() => (Array.isArray(chunks) ? chunks : []), [chunks]);
  const safeJobs = useMemo(() => (Array.isArray(jobs) ? jobs : []), [jobs]);
  const safeSearchResults = useMemo(
    () => (Array.isArray(searchState?.results) ? searchState.results : []),
    [searchState]
  );

  const selectedDocument = useMemo(
    () => safeDocuments.find((doc) => doc.id === selectedDocumentId) || null,
    [safeDocuments, selectedDocumentId]
  );

  const setResult = (result, successFallback) => {
    if (!result) return;
    setFeedback({
      type: result.success ? "success" : "error",
      text: result.message || successFallback,
    });
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: "error", text: "Vui lòng chọn tệp để upload." });
      return;
    }

    setJobStatus(null);
    const result = await onUploadFile(selectedFile, { asyncIndex: asyncMode });

    if (asyncMode && result?.job_id) {
      setFeedback({ type: "info", text: `Job #${result.job_id} đang xử lý... (document #${result.document_id})` });
      setJobStatus({ id: result.job_id, status: "processing" });
    } else {
      setResult(result, "Tài liệu đã được upload và indexing.");
    }

    if (result?.document_id) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTextSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !rawText.trim()) {
      setFeedback({ type: "error", text: "Cần nhập tiêu đề và nội dung tài liệu." });
      return;
    }

    setJobStatus(null);
    const result = await onIngestText({
      title: title.trim(),
      raw_text: rawText.trim(),
      source_uri: sourceUri.trim() || undefined,
      asyncIndex: asyncMode,
    });

    if (asyncMode && result?.job_id) {
      setFeedback({ type: "info", text: `Job #${result.job_id} đang xử lý... (document #${result.document_id})` });
      setJobStatus({ id: result.job_id, status: "processing" });
    } else {
      setResult(result, "Tài liệu text đã được ingest.");
    }

    if (result?.document_id) {
      setTitle("");
      setRawText("");
      setSourceUri("");
    }
  };

  const handleReindex = async () => {
    if (!selectedDocument) return;
    const result = await onReindexDocument(selectedDocument.id);
    setResult(result, "Reindex thành công.");
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;
    const confirmed = window.confirm(
      `Xóa tài liệu "${selectedDocument.title}" và toàn bộ chunks/index liên quan?`
    );
    if (!confirmed) return;

    const result = await onDeleteDocument(selectedDocument.id);
    setResult(result, "Đã xóa tài liệu.");
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      setFeedback({ type: "error", text: "Cần nhập câu truy vấn để search knowledge base." });
      return;
    }

    const result = await onSearchKnowledge({
      query: searchQuery.trim(),
      topK: Number(searchTopK || 5),
      documentId: searchScope === "selected" ? selectedDocumentId : undefined,
    });
    setResult(result, "Search knowledge thành công.");
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Knowledge base</h2>
          <p className={styles.subtitle}>
            Đồng bộ với backend `/api/knowledge`: upload tài liệu, chunking, indexing skeleton và xem chunks.
          </p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.asyncToggle}>
            <input
              type="checkbox"
              checked={asyncMode}
              onChange={(e) => setAsyncMode(e.target.checked)}
            />
            {" "}Async indexing
          </label>
          <button className={styles.secondaryBtn} type="button" onClick={onRefreshDocuments} disabled={isLoading}>
            Làm mới danh sách
          </button>
        </div>
      </header>

      {feedback.text ? (
        <div className={`${styles.feedback} ${feedback.type === "error" ? styles.error : styles.success}`}>
          {feedback.text}
        </div>
      ) : null}

      {jobStatus ? (
        <div className={`${styles.feedback} ${jobStatus.status === "failed" ? styles.error : styles.success}`}>
          Job #{jobStatus.id} — trạng thái: <strong>{jobStatus.status}</strong>
          {jobStatus.status === "processing" || jobStatus.status === "pending"
            ? " — đang xử lý, hãy làm mới danh sách để kiểm tra."
            : jobStatus.status === "completed" || jobStatus.status === "indexed"
              ? " — hoàn thành!"
              : ""}
        </div>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.column}>
          <form className={styles.card} onSubmit={handleUploadSubmit}>
            <h3 className={styles.cardTitle}>Upload tài liệu</h3>
            <p className={styles.cardHint}>Hỗ trợ hiện tại: txt, md, csv, log, json, py, js, yaml/yml; PDF/DOCX nếu backend có dependency.</p>
            <input
              ref={fileInputRef}
              className={styles.input}
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              disabled={isLoading}
            />
            <button className={styles.primaryBtn} type="submit" disabled={isLoading || !selectedFile}>
              {isLoading ? "Đang upload..." : "Upload + index"}
            </button>
          </form>

          <form className={styles.card} onSubmit={handleTextSubmit}>
            <h3 className={styles.cardTitle}>Ingest từ text</h3>
            <label className={styles.label} htmlFor="knowledge-title">Tiêu đề</label>
            <input
              id="knowledge-title"
              className={styles.input}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Product FAQ"
              disabled={isLoading}
            />

            <label className={styles.label} htmlFor="knowledge-uri">Source URI (tùy chọn)</label>
            <input
              id="knowledge-uri"
              className={styles.input}
              value={sourceUri}
              onChange={(event) => setSourceUri(event.target.value)}
              placeholder="https://example.com/docs/faq"
              disabled={isLoading}
            />

            <label className={styles.label} htmlFor="knowledge-text">Nội dung</label>
            <textarea
              id="knowledge-text"
              className={styles.textarea}
              rows={10}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Dán nội dung tài liệu vào đây..."
              disabled={isLoading}
            />

            <button className={styles.primaryBtn} type="submit" disabled={isLoading || !title.trim() || !rawText.trim()}>
              {isLoading ? "Đang ingest..." : "Ingest text"}
            </button>
          </form>

          <form className={styles.card} onSubmit={handleSearchSubmit}>
            <h3 className={styles.cardTitle}>Search indexed chunks</h3>
            <p className={styles.cardHint}>
              Query trên knowledge base đã index. Có thể search toàn bộ hoặc chỉ trong tài liệu đang chọn.
            </p>

            <label className={styles.label} htmlFor="knowledge-search-query">Query</label>
            <input
              id="knowledge-search-query"
              className={styles.input}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ví dụ: release notes, product FAQ, beta gamma"
              disabled={isLoading}
            />

            <label className={styles.label} htmlFor="knowledge-search-topk">Top K</label>
            <input
              id="knowledge-search-topk"
              className={styles.input}
              type="number"
              min="1"
              max="20"
              value={searchTopK}
              onChange={(event) => setSearchTopK(event.target.value)}
              disabled={isLoading}
            />

            <label className={styles.label} htmlFor="knowledge-search-scope">Scope</label>
            <select
              id="knowledge-search-scope"
              className={styles.input}
              value={searchScope}
              onChange={(event) => setSearchScope(event.target.value)}
              disabled={isLoading}
            >
              <option value="all">Toàn bộ knowledge base</option>
              <option value="selected" disabled={!selectedDocumentId}>Chỉ tài liệu đang chọn</option>
            </select>

            <button className={styles.primaryBtn} type="submit" disabled={isLoading || !searchQuery.trim()}>
              {isLoading ? "Đang search..." : "Search knowledge"}
            </button>
          </form>
        </div>

        <div className={styles.columnWide}>
          <div className={styles.card}>
            <div className={styles.rowHeader}>
              <h3 className={styles.cardTitle}>Documents</h3>
              <span className={styles.badge}>{safeDocuments.length}</span>
            </div>

            {safeDocuments.length === 0 ? (
              <div className={styles.emptyState}>Chưa có tài liệu nào trong knowledge base.</div>
            ) : (
              <div className={styles.documentList}>
                {safeDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`${styles.documentBtn} ${doc.id === selectedDocumentId ? styles.documentBtnActive : ""}`}
                    onClick={() => onSelectDocument(doc.id)}
                    disabled={isLoading}
                  >
                    <span className={styles.documentTitle}>{doc.title}</span>
                    <span className={styles.documentMeta}>#{doc.id} · {doc.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.rowHeader}>
              <h3 className={styles.cardTitle}>Chi tiết tài liệu</h3>
              {selectedDocument ? (
                <div className={styles.actionRow}>
                  <button className={styles.secondaryBtn} type="button" onClick={handleReindex} disabled={isLoading}>
                    Reindex
                  </button>
                  <button className={styles.dangerBtn} type="button" onClick={handleDelete} disabled={isLoading}>
                    Xóa
                  </button>
                </div>
              ) : null}
            </div>

            {!selectedDocument ? (
              <div className={styles.emptyState}>Chọn một tài liệu để xem metadata và chunks.</div>
            ) : (
              <>
                <div className={styles.metaGrid}>
                  <div><strong>ID:</strong> {selectedDocument.id}</div>
                  <div><strong>Status:</strong> {selectedDocument.status}</div>
                  <div><strong>Owner:</strong> {selectedDocument.owner_username}</div>
                  <div><strong>Source type:</strong> {selectedDocument.source_type}</div>
                  <div><strong>MIME:</strong> {selectedDocument.mime_type || "-"}</div>
                  <div><strong>Source URI:</strong> {selectedDocument.source_uri || "-"}</div>
                  <div><strong>Created:</strong> {formatDate(selectedDocument.created_at)}</div>
                  <div><strong>Updated:</strong> {formatDate(selectedDocument.updated_at)}</div>
                </div>

                <div className={styles.checksumBox}>
                  <strong>Checksum:</strong>
                  <code className={styles.code}>{selectedDocument.checksum || "-"}</code>
                </div>

                <div className={styles.rowHeader}>
                  <h4 className={styles.subTitle}>Chunks</h4>
                  <span className={styles.badge}>{safeChunks.length}</span>
                </div>

                {safeChunks.length === 0 ? (
                  <div className={styles.emptyState}>Tài liệu này chưa có chunk hoặc chưa được index xong.</div>
                ) : (
                  <div className={styles.chunkList}>
                    {safeChunks.map((chunk) => (
                      <article key={chunk.id} className={styles.chunkCard}>
                        <div className={styles.chunkHeader}>
                          <span>Chunk #{chunk.chunk_index}</span>
                          <span>{chunk.token_count || 0} tokens</span>
                        </div>
                        <pre className={styles.chunkContent}>{chunk.content}</pre>
                      </article>
                    ))}
                  </div>
                )}

                <div className={styles.rowHeader}>
                  <h4 className={styles.subTitle}>Ingestion jobs</h4>
                  <span className={styles.badge}>{safeJobs.length}</span>
                </div>

                {safeJobs.length === 0 ? (
                  <div className={styles.emptyState}>Chưa có ingestion job nào cho tài liệu này.</div>
                ) : (
                  <div className={styles.documentList}>
                    {safeJobs.map((job) => (
                      <article key={job.id} className={styles.chunkCard}>
                        <div className={styles.chunkHeader}>
                          <span>Job #{job.id}</span>
                          <span>{job.status}</span>
                        </div>
                        <div className={styles.metaGrid}>
                          <div><strong>Created:</strong> {formatDate(job.created_at)}</div>
                          <div><strong>Updated:</strong> {formatDate(job.updated_at)}</div>
                        </div>
                        {job.error_message ? (
                          <pre className={styles.chunkContent}>{job.error_message}</pre>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.rowHeader}>
              <h3 className={styles.cardTitle}>Search results</h3>
              <span className={styles.badge}>{safeSearchResults.length}</span>
            </div>

            {searchState?.query ? (
              <p className={styles.cardHint}>
                Query: <strong>{searchState.query}</strong>
                {searchState?.retrieval_id ? ` · retrieval #${searchState.retrieval_id}` : ""}
                {searchState?.strategy ? ` · ${searchState.strategy}` : ""}
                {searchState?.evidence_strength ? ` · ${searchState.evidence_strength}` : ""}
                {searchState?.fallback_used && searchState?.fallback_reason
                  ? ` · fallback:${searchState.fallback_reason}`
                  : ""}
                {searchState?.rewritten_query && searchState.rewritten_query !== searchState.query
                  ? ` · rewritten: ${searchState.rewritten_query}`
                  : ""}
              </p>
            ) : null}

            {safeSearchResults.length === 0 ? (
              <div className={styles.emptyState}>Chưa có kết quả search nào. Hãy nhập query để kiểm tra khả năng retrieval.</div>
            ) : (
              <div className={styles.chunkList}>
                {safeSearchResults.map((result) => (
                  <article key={`${result.document_id}-${result.chunk_id}`} className={styles.chunkCard}>
                    <div className={styles.chunkHeader}>
                      <span>{result.title}</span>
                      <span>score {Number(result.score || 0).toFixed(3)}</span>
                    </div>
                    <div className={styles.metaGrid}>
                      <div><strong>Document:</strong> #{result.document_id}</div>
                      <div><strong>Chunk:</strong> #{result.chunk_index}</div>
                      <div><strong>Source type:</strong> {result.source_type}</div>
                      <div><strong>Embedding:</strong> {result.embedding_model || "-"}</div>
                      <div><strong>Semantic:</strong> {Number(result.semantic_score || 0).toFixed(3)}</div>
                      <div><strong>Lexical:</strong> {Number(result.lexical_score || 0).toFixed(3)}</div>
                    </div>
                    <pre className={styles.chunkContent}>{result.snippet}</pre>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}



