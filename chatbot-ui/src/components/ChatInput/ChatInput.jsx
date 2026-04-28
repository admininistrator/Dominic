import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ChatInput.module.css";

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;

const IconImage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="9" cy="9" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22 11 13 2 9z" />
  </svg>
);

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconText = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconDoc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data-URI
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatInput({
  onSendMessage,
  disabled,
  onUploadKnowledgeFile,
  onIngestKnowledgeText,
  isKnowledgeLoading,
  sessionDocuments = [],
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]); // [{dataUri, name, type}]
  const [importPanelState, setImportPanelState] = useState("closed");
  const [ingestMode, setIngestMode] = useState(false);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestText, setIngestText] = useState("");
  const [feedback, setFeedback] = useState("");
  const fileInputRef = useRef(null);
  const knowledgeFileRef = useRef(null);
  const plusMenuRef = useRef(null);
  const closePanelTimerRef = useRef(null);
  const openPanelRafRef = useRef(null);

  const importPanelMounted = importPanelState !== "closed";
  const importPanelOpen = importPanelState === "open";

  const openImportPanel = useCallback(() => {
    window.clearTimeout(closePanelTimerRef.current);
    window.cancelAnimationFrame(openPanelRafRef.current);
    setImportPanelState("opening");
    setFeedback("");
  }, []);

  const closeImportPanel = useCallback(() => {
    if (importPanelState === "closed" || importPanelState === "closing") return;
    window.clearTimeout(closePanelTimerRef.current);
    window.cancelAnimationFrame(openPanelRafRef.current);
    setImportPanelState("closing");
    setIngestMode(false);
    closePanelTimerRef.current = window.setTimeout(() => {
      setImportPanelState("closed");
    }, 180);
  }, [importPanelState]);

  const toggleImportPanel = () => {
    if (importPanelState === "open" || importPanelState === "opening") {
      closeImportPanel();
      return;
    }
    openImportPanel();
  };

  useEffect(() => {
    if (importPanelState !== "opening") return undefined;
    openPanelRafRef.current = window.requestAnimationFrame(() => {
      setImportPanelState("open");
    });
    return () => window.cancelAnimationFrame(openPanelRafRef.current);
  }, [importPanelState]);

  // Close plus menu on outside click
  useEffect(() => {
    if (!importPanelMounted) return;
    const handleOutside = (e) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
        closeImportPanel();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [closeImportPanel, importPanelMounted]);

  useEffect(() => {
    return () => {
      window.clearTimeout(closePanelTimerRef.current);
      window.cancelAnimationFrame(openPanelRafRef.current);
    };
  }, []);

  const submit = () => {
    const value = text.trim();
    if ((!value && images.length === 0) || disabled) return;
    onSendMessage(value, images.map((i) => ({ dataUri: i.dataUri, type: i.type })));
    setText("");
    setImages([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFiles = async (files) => {
    const allowed = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const toAdd = allowed.slice(0, remaining);
    const invalid = toAdd.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (invalid.length) {
      alert(`Ảnh quá lớn (tối đa ${MAX_SIZE_MB}MB): ${invalid.map((f) => f.name).join(", ")}`);
      return;
    }
    const encoded = await Promise.all(
      toAdd.map(async (f) => ({ dataUri: await fileToBase64(f), name: f.name, type: f.type }))
    );
    setImages((prev) => [...prev, ...encoded].slice(0, MAX_IMAGES));
  };

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles = items
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile());
    if (imageFiles.length) handleFiles(imageFiles);
  };

  const handleKnowledgeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadKnowledgeFile) return;
    setFeedback("Đang upload...");
    const result = await onUploadKnowledgeFile(file);
    setFeedback(result?.message || (result?.success ? "Upload thành công!" : "Upload thất bại."));
    if (result?.success) {
      closeImportPanel();
      setTimeout(() => setFeedback(""), 3000);
    }
    if (knowledgeFileRef.current) knowledgeFileRef.current.value = "";
  };

  const handleImageImport = () => {
    fileInputRef.current?.click();
    closeImportPanel();
  };

  const handleIngestSubmit = async () => {
    if (!ingestTitle.trim() || !ingestText.trim() || !onIngestKnowledgeText) return;
    setFeedback("Đang ingest...");
    const result = await onIngestKnowledgeText({
      title: ingestTitle.trim(),
      raw_text: ingestText.trim(),
    });
    setFeedback(result?.message || (result?.success ? "Ingest thành công!" : "Ingest thất bại."));
    if (result?.success) {
      setIngestTitle("");
      setIngestText("");
      closeImportPanel();
      setTimeout(() => setFeedback(""), 3000);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formInner}>
        {sessionDocuments.length > 0 && (
          <div className={styles.docsBadgeRow}>
            {sessionDocuments.map((document) => (
              <span key={document.id || document.title} className={styles.docChip}>
                <IconDoc />
                <span className={styles.docsBadgeText}>{document.title}</span>
              </span>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div className={styles.imagePreview}>
            {images.map((img, idx) => (
              <div key={idx} className={styles.imageThumb}>
                <img src={img.dataUri} alt={img.name} />
                <button
                  type="button"
                  className={styles.imageRemove}
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  title="Xóa ảnh"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.inputRow}>
          <div className={styles.inputContent}>
            <textarea
              className={styles.textarea}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Nhắn Dominic..."
              disabled={disabled}
            />
            <div className={styles.inputFooter}>
              <div className={styles.importArea} ref={plusMenuRef}>
                <button
                  type="button"
                  className={`${styles.plusButton} ${importPanelMounted ? styles.plusButtonActive : ""}`}
                  onClick={toggleImportPanel}
                  title="Import Source"
                >
                  <IconPlus />
                </button>

                {importPanelMounted && (
                  <div
                    className={`${styles.plusPopup} ${
                      importPanelOpen ? styles.plusPopupOpen : styles.plusPopupClosing
                    }`}
                  >
                    <div className={styles.plusPopupHeader}>
                      <span className={styles.plusPopupTitle}>Import Source</span>
                    </div>

                    {!ingestMode ? (
                      <div className={styles.plusPopupActions}>
                        <button
                          type="button"
                          className={styles.plusPopupBtn}
                          disabled={isKnowledgeLoading}
                          onClick={() => knowledgeFileRef.current?.click()}
                        >
                          <IconUpload />
                          <span className={styles.plusPopupLabel}>Upload tài liệu</span>
                        </button>
                        <button
                          type="button"
                          className={styles.plusPopupBtn}
                          disabled={disabled || images.length >= MAX_IMAGES}
                          onClick={handleImageImport}
                        >
                          <IconImage />
                          <span className={styles.plusPopupLabel}>Upload ảnh</span>
                        </button>
                        <button
                          type="button"
                          className={styles.plusPopupBtn}
                          disabled={isKnowledgeLoading}
                          onClick={() => setIngestMode(true)}
                        >
                          <IconText />
                          <span className={styles.plusPopupLabel}>Nhập text trực tiếp</span>
                        </button>
                      </div>
                    ) : (
                      <div className={styles.ingestForm}>
                        <input
                          className={styles.ingestInput}
                          value={ingestTitle}
                          onChange={(e) => setIngestTitle(e.target.value)}
                          placeholder="Tiêu đề tài liệu"
                          disabled={isKnowledgeLoading}
                        />
                        <textarea
                          className={styles.ingestTextarea}
                          rows={5}
                          value={ingestText}
                          onChange={(e) => setIngestText(e.target.value)}
                          placeholder="Dán nội dung tài liệu vào đây..."
                          disabled={isKnowledgeLoading}
                        />
                        <div className={styles.ingestBtnRow}>
                          <button
                            type="button"
                            className={styles.ingestCancelBtn}
                            onClick={() => setIngestMode(false)}
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            className={styles.ingestSubmitBtn}
                            disabled={isKnowledgeLoading || !ingestTitle.trim() || !ingestText.trim()}
                            onClick={handleIngestSubmit}
                          >
                            {isKnowledgeLoading ? "Đang xử lý..." : "Import"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {feedback && <div className={styles.feedbackInline}>{feedback}</div>}
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={disabled} title="Gửi">
              <IconSend />
            </button>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={knowledgeFileRef}
        type="file"
        accept=".txt,.md,.csv,.log,.json,.py,.js,.yaml,.yml,.pdf,.docx,.pptx,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleKnowledgeUpload}
      />
    </form>
  );
}
