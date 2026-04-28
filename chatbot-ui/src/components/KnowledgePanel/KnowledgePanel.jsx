import { useMemo, useState } from "react";
import styles from "./KnowledgePanel.module.css";
import { formatDate } from "../../utils/formatters";

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChat = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconDoc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export default function KnowledgePanel({
  documents,
  selectedDocumentId,
  chunks,
  jobs,
  searchState,
  isLoading,
  onSelectDocument,
  onRefreshDocuments,
  onSearchKnowledge,
  onReindexDocument,
  onDeleteDocument,
  sessions = [],
  activeSessionId,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchTopK = 5;
  const searchScope = "all";
  const [feedback, setFeedback] = useState({ type: "info", text: "" });
  const [viewMode, setViewMode] = useState("list"); // "list" | "session" | "detail"
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const safeDocuments = useMemo(() => (Array.isArray(documents) ? documents : []), [documents]);
  const safeChunks = useMemo(() => (Array.isArray(chunks) ? chunks : []), [chunks]);
  const safeJobs = useMemo(() => (Array.isArray(jobs) ? jobs : []), [jobs]);
  const safeSessions = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions]);
  const safeSearchResults = useMemo(
    () => (Array.isArray(searchState?.results) ? searchState.results : []),
    [searchState]
  );

  const selectedDocument = useMemo(
    () => safeDocuments.find((doc) => doc.id === selectedDocumentId) || null,
    [safeDocuments, selectedDocumentId]
  );

  // Group documents by session
  const globalDocs = useMemo(
    () => safeDocuments.filter((doc) => !doc.session_id),
    [safeDocuments]
  );

  const sessionDocsMap = useMemo(() => {
    const map = new Map();
    for (const doc of safeDocuments) {
      if (doc.session_id) {
        if (!map.has(doc.session_id)) map.set(doc.session_id, []);
        map.get(doc.session_id).push(doc);
      }
    }
    return map;
  }, [safeDocuments]);

  const sessionsWithDocs = useMemo(() => {
    return safeSessions.filter((s) => sessionDocsMap.has(s.id));
  }, [safeSessions, sessionDocsMap]);

  const currentSessionDocs = useMemo(() => {
    if (!selectedSessionId) return [];
    return sessionDocsMap.get(selectedSessionId) || [];
  }, [selectedSessionId, sessionDocsMap]);

  const setResult = (result, successFallback) => {
    if (!result) return;
    setFeedback({
      type: result.success ? "success" : "error",
      text: result.message || successFallback,
    });
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
    if (result?.success) {
      setViewMode(selectedSessionId ? "session" : "list");
    }
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

  const handleSelectSession = (sessionId) => {
    setSelectedSessionId(sessionId);
    setViewMode("session");
  };

  const handleSelectDocInSession = async (docId) => {
    setViewMode("detail");
    await onSelectDocument(docId);
  };

  const handleBack = () => {
    if (viewMode === "detail" && selectedSessionId) {
      setViewMode("session");
    } else {
      setViewMode("list");
      setSelectedSessionId(null);
    }
  };

  // ── List view: sessions with docs + global docs ──
  if (viewMode === "list") {
    return (
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Knowledge base</h2>
            <p className={styles.subtitle}>
              Tài liệu knowledge được tổ chức theo từng đoạn chat. Import tài liệu bằng nút + trong thanh chat.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} type="button" onClick={onRefreshDocuments} disabled={isLoading} data-testid="knowledge-refresh-button">
              Làm mới
            </button>
          </div>
        </header>

        {feedback.text ? (
          <div className={`${styles.feedback} ${feedback.type === "error" ? styles.error : styles.success}`}>
            {feedback.text}
          </div>
        ) : null}

        <div className={styles.listGrid}>
          {/* Sessions with docs */}
          {sessionsWithDocs.length > 0 && (
            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>
                <IconChat /> Tài liệu theo đoạn chat
              </h3>
              <div className={styles.sessionList}>
                {sessionsWithDocs.map((session) => {
                  const docs = sessionDocsMap.get(session.id) || [];
                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={`${styles.sessionCard} ${session.id === activeSessionId ? styles.sessionCardActive : ""}`}
                      onClick={() => handleSelectSession(session.id)}
                      data-testid={`knowledge-session-${session.id}`}
                    >
                      <div className={styles.sessionCardHeader}>
                        <IconChat />
                        <span className={styles.sessionCardTitle}>{session.title || `Chat ${session.id}`}</span>
                        {session.id === activeSessionId && (
                          <span className={styles.activeBadge}>Active</span>
                        )}
                      </div>
                      <div className={styles.sessionCardMeta}>
                        <IconDoc />
                        <span>{docs.length} tài liệu</span>
                        <span className={styles.sessionCardDate}>{formatDate(session.updated_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Global docs */}
          {globalDocs.length > 0 && (
            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>
                <IconGlobe /> Tài liệu chung
              </h3>
              <div className={styles.documentList}>
                {globalDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`${styles.documentBtn} ${doc.id === selectedDocumentId ? styles.documentBtnActive : ""}`}
                    onClick={() => {
                      setSelectedSessionId(null);
                      setViewMode("detail");
                      onSelectDocument(doc.id);
                    }}
                    disabled={isLoading}
                    data-testid={`knowledge-document-${doc.id}`}
                  >
                    <span className={styles.documentTitle}>{doc.title}</span>
                    <span className={styles.documentMeta}>#{doc.id} · {doc.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sessionsWithDocs.length === 0 && globalDocs.length === 0 && (
            <div className={styles.emptyState}>
              Chưa có tài liệu nào. Bấm nút <strong>+</strong> trong thanh chat để import tài liệu.
            </div>
          )}

          {/* Search section */}
          <div className={styles.card}>
            <form onSubmit={handleSearchSubmit}>
              <h3 className={styles.cardTitle}>Search knowledge base</h3>
              <div className={styles.searchRow}>
                <input
                  className={styles.input}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập câu truy vấn..."
                  disabled={isLoading}
                  data-testid="knowledge-search-input"
                />
                <button className={styles.primaryBtn} type="submit" disabled={isLoading || !searchQuery.trim()} data-testid="knowledge-search-button">
                  Search
                </button>
              </div>
            </form>

            {safeSearchResults.length > 0 && (
              <div className={styles.chunkList}>
                {safeSearchResults.map((result) => (
                  <article key={`${result.document_id}-${result.chunk_id}`} className={styles.chunkCard} data-testid="knowledge-search-result">
                    <div className={styles.chunkHeader}>
                      <span>{result.title}</span>
                      <span>score {Number(result.score || 0).toFixed(3)}</span>
                    </div>
                    <pre className={styles.chunkContent}>{result.snippet}</pre>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Session view: docs in a specific session ──
  if (viewMode === "session") {
    const sessionInfo = safeSessions.find((s) => s.id === selectedSessionId);
    return (
      <section className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.breadcrumb}>
            <button type="button" className={styles.backBtn} onClick={handleBack}>
              <IconBack /> Knowledge
            </button>
            <span className={styles.breadcrumbSep}>›</span>
            <span className={styles.breadcrumbCurrent}>
              {sessionInfo?.title || `Chat ${selectedSessionId}`}
            </span>
          </div>
        </header>

        <div className={styles.listGrid}>
          <div className={styles.card}>
            <div className={styles.rowHeader}>
              <h3 className={styles.cardTitle}>Tài liệu trong đoạn chat</h3>
              <span className={styles.badge}>{currentSessionDocs.length}</span>
            </div>

            {currentSessionDocs.length === 0 ? (
              <div className={styles.emptyState}>Chưa có tài liệu nào trong đoạn chat này.</div>
            ) : (
              <div className={styles.documentList}>
                {currentSessionDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`${styles.documentBtn} ${doc.id === selectedDocumentId ? styles.documentBtnActive : ""}`}
                    onClick={() => handleSelectDocInSession(doc.id)}
                    disabled={isLoading}
                    data-testid={`knowledge-document-${doc.id}`}
                  >
                    <span className={styles.documentTitle}>{doc.title}</span>
                    <span className={styles.documentMeta}>
                      #{doc.id} · {doc.status} · {formatDate(doc.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Detail view: single document details ──
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <button type="button" className={styles.backBtn} onClick={handleBack} data-testid="knowledge-back-button">
            <IconBack /> {selectedSessionId ? "Session" : "Knowledge"}
          </button>
          <span className={styles.breadcrumbSep}>›</span>
          <span className={styles.breadcrumbCurrent}>
            {selectedDocument?.title || "Chi tiết tài liệu"}
          </span>
        </div>
      </header>

      {feedback.text ? (
        <div className={`${styles.feedback} ${feedback.type === "error" ? styles.error : styles.success}`}>
          {feedback.text}
        </div>
      ) : null}

      <div className={styles.listGrid}>
        <div className={styles.card}>
          <div className={styles.rowHeader}>
            <h3 className={styles.cardTitle}>Chi tiết tài liệu</h3>
            {selectedDocument ? (
              <div className={styles.actionRow}>
                <button className={styles.secondaryBtn} type="button" onClick={handleReindex} disabled={isLoading} data-testid="knowledge-reindex-button">
                  Reindex
                </button>
                <button className={styles.dangerBtn} type="button" onClick={handleDelete} disabled={isLoading} data-testid="knowledge-delete-button">
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
                <div><strong>Session:</strong> {selectedDocument.session_id ? `#${selectedDocument.session_id}` : "Global"}</div>
                <div><strong>Created:</strong> {formatDate(selectedDocument.created_at)}</div>
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
      </div>
    </section>
  );
}
