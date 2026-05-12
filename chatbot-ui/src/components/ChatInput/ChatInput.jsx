import { AnimatePresence, motion as Motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getModelPickerIcon } from "../../assets/icons";
import {
	getChatModelDescription,
	getChatModelLabel,
	getGroupedChatModelOptions,
  getDefaultThinkingEffortForModel,
  getThinkingEffortLabel,
  getThinkingEffortOptionsForModel,
  isChatModelAvailable,
  supportsThinkingEffort,
} from "../../config/uiConfig";
import styles from "./ChatInput.module.css";

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_TEXTAREA_HEIGHT = 220;
const POPUP_OPEN_TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };
const POPUP_EXIT_TRANSITION = { duration: 0.36, ease: [0.22, 1, 0.36, 1] };
const POPUP_MOTION_VARIANTS = {
  hidden: { opacity: 0, scale: 0, transition: POPUP_EXIT_TRANSITION },
  visible: { opacity: 1, scale: 1, transition: POPUP_OPEN_TRANSITION },
};

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

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
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
  selectedModel,
  availableModels = [],
  onModelChange,
  thinkingEffortByModel = {},
  onThinkingEffortChange,
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]); // [{dataUri, name, type}]
  const [importPanelState, setImportPanelState] = useState("closed");
  const [ingestMode, setIngestMode] = useState(false);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestText, setIngestText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const fileInputRef = useRef(null);
  const knowledgeFileRef = useRef(null);
  const plusMenuRef = useRef(null);
  const modelMenuRef = useRef(null);
  const thinkingMenuRef = useRef(null);
  const textareaRef = useRef(null);
  const closePanelTimerRef = useRef(null);
  const openPanelRafRef = useRef(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [thinkingMenuOpen, setThinkingMenuOpen] = useState(false);

  const importPanelMounted = importPanelState !== "closed";
  const importPanelOpen = importPanelState === "open";
  const selectableModels = availableModels.filter((modelName) => isChatModelAvailable(modelName));
  const activeModel = isChatModelAvailable(selectedModel)
    ? selectedModel
    : selectableModels[0] || availableModels[0] || "";
  const activeModelLabel = getChatModelLabel(activeModel);
  const groupedModelOptions = getGroupedChatModelOptions(availableModels);
  const thinkingEffortSupported = supportsThinkingEffort(activeModel);
  const thinkingEffortOptions = getThinkingEffortOptionsForModel(activeModel);
  const activeThinkingEffort = thinkingEffortByModel[activeModel] || getDefaultThinkingEffortForModel(activeModel);
  const activeThinkingEffortLabel = getThinkingEffortLabel(activeModel, activeThinkingEffort);
  const activeModelIcon = getModelPickerIcon(activeModel);

  const resizeTextarea = useCallback((textarea) => {
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  const openImportPanel = useCallback(() => {
    window.clearTimeout(closePanelTimerRef.current);
    window.cancelAnimationFrame(openPanelRafRef.current);
    setModelMenuOpen(false);
    setThinkingMenuOpen(false);
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

  const openModelMenu = useCallback(() => {
    closeImportPanel();
    setThinkingMenuOpen(false);
    setModelMenuOpen(true);
  }, [closeImportPanel]);

  const closeModelMenu = useCallback(() => {
    setModelMenuOpen(false);
  }, []);

  const openThinkingMenu = () => {
    if (!thinkingEffortSupported) return;
    closeImportPanel();
    setModelMenuOpen(false);
    setThinkingMenuOpen(true);
  };

  const closeThinkingMenu = useCallback(() => {
    setThinkingMenuOpen(false);
  }, []);

  const toggleModelMenu = () => {
    if (disabled || selectableModels.length === 0) return;
    if (modelMenuOpen) {
      closeModelMenu();
      return;
    }
    openModelMenu();
  };

  const toggleThinkingMenu = () => {
    if (disabled || !thinkingEffortSupported) return;
    if (thinkingMenuOpen) {
      closeThinkingMenu();
      return;
    }
    openThinkingMenu();
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
    if (!modelMenuOpen) return undefined;
    const handleOutside = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        closeModelMenu();
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeModelMenu();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeModelMenu, modelMenuOpen]);

  useEffect(() => {
    if (!thinkingMenuOpen) return undefined;
    const handleOutside = (e) => {
      if (thinkingMenuRef.current && !thinkingMenuRef.current.contains(e.target)) {
        closeThinkingMenu();
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeThinkingMenu();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeThinkingMenu, thinkingMenuOpen]);

  useEffect(() => {
    return () => {
      window.clearTimeout(closePanelTimerRef.current);
      window.cancelAnimationFrame(openPanelRafRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [resizeTextarea, text]);

  const submit = () => {
    const value = text.trim();
    if ((!value && images.length === 0) || disabled) return;
    onSendMessage(value, images.map((i) => ({ dataUri: i.dataUri, type: i.type })), {
      useWebSearch,
      model: selectedModel,
      reasoningEffort: thinkingEffortSupported ? activeThinkingEffort : undefined,
    });
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

  const handleTextChange = (e) => {
    resizeTextarea(e.target);
    setText(e.target.value);
  };

  const handleFiles = async (files) => {
    const allowed = Array.from(files).filter((f) => ALLOWED_IMAGE_TYPES.has(f.type));
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
      .filter((i) => i.kind === "file" && ALLOWED_IMAGE_TYPES.has(i.type))
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

  const handleModelSelect = (modelName) => {
    if (!isChatModelAvailable(modelName)) return;
    onModelChange?.(modelName);
    closeModelMenu();
  };

  const handleThinkingEffortSelect = (effortValue) => {
    if (!activeModel || !thinkingEffortSupported) return;
    onThinkingEffortChange?.(activeModel, effortValue);
    closeThinkingMenu();
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
              ref={textareaRef}
              className={styles.textarea}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Nhắn Dominic..."
              disabled={disabled}
              data-testid="chat-textarea"
            />
            <div className={styles.inputFooter}>
              <div className={styles.importArea} ref={plusMenuRef}>
                <button
                  type="button"
                  className={`${styles.plusButton} ${importPanelMounted ? styles.plusButtonActive : ""}`}
                  onClick={toggleImportPanel}
                  title="Import Source"
                  data-testid="chat-import-button"
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
                          data-testid="upload-document-button"
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
                          data-testid="ingest-text-button"
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
                          data-testid="ingest-title-input"
                        />
                        <textarea
                          className={styles.ingestTextarea}
                          rows={5}
                          value={ingestText}
                          onChange={(e) => setIngestText(e.target.value)}
                          placeholder="Dán nội dung tài liệu vào đây..."
                          disabled={isKnowledgeLoading}
                          data-testid="ingest-textarea"
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
                            data-testid="ingest-submit-button"
                          >
                            {isKnowledgeLoading ? "Đang xử lý..." : "Import"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`${styles.webSearchToggle} ${useWebSearch ? styles.webSearchToggleActive : ""}`}
                onClick={() => setUseWebSearch((current) => !current)}
                disabled={disabled}
                title="Bật hoặc tắt AI web search bằng Tavily"
                data-testid="web-search-toggle"
              >
                <span className={styles.webSearchToggleDot} />
                <span className={styles.webSearchToggleLabelRow}>
                  <span className={styles.webSearchToggleLabelBase}>Web search</span>
                  <span className={styles.webSearchToggleSuffixWrap} aria-hidden={!useWebSearch}>
                    <span className={styles.webSearchToggleSuffix}> đang bật</span>
                  </span>
                </span>
              </button>
              <div className={styles.modelArea} ref={modelMenuRef}>
                <Motion.button
                  type="button"
                  className={`${styles.modelPicker} ${modelMenuOpen ? styles.modelPickerOpen : ""}`}
                  title={`Model hiện tại: ${activeModelLabel || ""}`}
                  onClick={toggleModelMenu}
                  disabled={disabled || selectableModels.length === 0}
                  data-testid="chat-model-select"
                  aria-label="Chọn model AI"
                  aria-expanded={modelMenuOpen}
                  whileTap={{ y: 1 }}
                >
                  <span className={styles.modelPickerBadge}>
                    <img src={activeModelIcon} alt="" className={styles.modelPickerBadgeImage} />
                  </span>
                  <span className={styles.modelPickerMeta}>
                    <span className={styles.modelPickerLabel}>Model AI</span>
                    <span className={styles.modelPickerValue}>{activeModelLabel || "Chọn model"}</span>
                  </span>
                  <span className={`${styles.modelPickerChevron} ${modelMenuOpen ? styles.modelPickerChevronOpen : ""}`}>
                    <IconChevronDown />
                  </span>
                </Motion.button>

                <AnimatePresence initial={false}>
                  {modelMenuOpen ? (
                    <div className={styles.modelPopupShell} data-testid="chat-model-menu">
                      <Motion.div
                        key="chat-model-menu"
                        className={styles.modelPopup}
                        variants={POPUP_MOTION_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                      >
                        <div className={styles.modelPopupHeader}>
                          <span className={styles.modelPopupTitle}>Chọn model</span>
                        </div>
                        <div className={styles.modelOptionList}>
                          {groupedModelOptions.map(({ group, models }) => (
                            <section key={group} className={styles.modelGroup} aria-label={group}>
                              <div className={styles.modelGroupHeader}>{group}</div>
                              <div className={styles.modelGroupList}>
                                {models.map((modelOption) => {
                                  const modelName = modelOption.id;
                                  const isAvailable = isChatModelAvailable(modelName);
                                  const modelLabel = getChatModelLabel(modelName);
                                  const modelDescription = getChatModelDescription(modelName);
                                  const isActive = modelName === selectedModel;
                                  const thinkingEffort = thinkingEffortByModel[modelName];
                                  const thinkingEffortEnabled = isAvailable && supportsThinkingEffort(modelName);
                                  const thinkingEffortLabel = getThinkingEffortLabel(modelName, thinkingEffort);
                                  return (
                                    <button
                                      key={modelName}
                                      type="button"
                                      className={`${styles.modelOption} ${isActive ? styles.modelOptionActive : ""} ${!isAvailable ? styles.modelOptionDisabled : ""}`}
                                      onClick={() => handleModelSelect(modelName)}
                                      data-testid={`chat-model-option-${modelName}`}
                                      disabled={!isAvailable}
                                      aria-disabled={!isAvailable}
                                    >
                                      <span className={styles.modelOptionText}>
                                        <span className={styles.modelOptionTopRow}>
                                          <span className={styles.modelOptionTitle}>{modelLabel}</span>
                                          <span className={styles.modelOptionBadges}>
                                            {thinkingEffortEnabled && thinkingEffortLabel && (
                                              <span className={styles.modelOptionEffortBadge}>{thinkingEffortLabel}</span>
                                            )}
                                            {isActive && <span className={styles.modelOptionBadge}>Đang dùng</span>}
                                          </span>
                                        </span>
                                        {modelDescription && <span className={styles.modelOptionDescription}>{modelDescription}</span>}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          ))}
                        </div>
                      </Motion.div>
                    </div>
                  ) : null}
                </AnimatePresence>
              </div>
              {thinkingEffortSupported && (
                <div className={styles.thinkingArea} ref={thinkingMenuRef}>
                  <Motion.button
                    type="button"
                    className={`${styles.thinkingPicker} ${thinkingMenuOpen ? styles.thinkingPickerOpen : ""}`}
                    onClick={toggleThinkingMenu}
                    disabled={disabled}
                    title={`Thinking effort hiện tại: ${activeThinkingEffortLabel}`}
                    data-testid="chat-thinking-effort-select"
                    aria-label="Chọn thinking effort"
                    aria-expanded={thinkingMenuOpen}
                    whileTap={{ y: 1 }}
                  >
                    <span className={styles.thinkingPickerMeta}>
                      <span className={styles.thinkingPickerLabel}>Thinking</span>
                      <span className={styles.thinkingPickerValue}>{activeThinkingEffortLabel}</span>
                    </span>
                    <span className={`${styles.thinkingPickerChevron} ${thinkingMenuOpen ? styles.thinkingPickerChevronOpen : ""}`}>
                      <IconChevronDown />
                    </span>
                  </Motion.button>

                  <AnimatePresence initial={false}>
                    {thinkingMenuOpen ? (
                      <div className={styles.thinkingPopupShell} data-testid="chat-thinking-effort-menu">
                        <Motion.div
                          key="chat-thinking-effort-menu"
                          className={styles.thinkingPopup}
                          variants={POPUP_MOTION_VARIANTS}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                        >
                          <div className={styles.thinkingPopupHeader}>
                            <span className={styles.thinkingPopupTitle}>Thinking effort</span>
                            <span className={styles.thinkingPopupModel}>{activeModelLabel}</span>
                          </div>
                          <div className={styles.thinkingOptionList}>
                            {thinkingEffortOptions.map((option) => {
                              const isSelected = option.value === activeThinkingEffort;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={`${styles.thinkingOption} ${isSelected ? styles.thinkingOptionActive : ""}`}
                                  onClick={() => handleThinkingEffortSelect(option.value)}
                                  data-testid={`chat-thinking-effort-${option.value}`}
                                  disabled={option.disabled}
                                >
                                  <span className={styles.thinkingOptionTitle}>{option.label}</span>
                                  {option.disabled ? (
                                    <span className={styles.thinkingOptionDisabledBadge}>Chưa hỗ trợ</span>
                                  ) : (
                                    isSelected && <span className={styles.thinkingOptionBadge}>Đang dùng</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </Motion.div>
                      </div>
                    ) : null}
                  </AnimatePresence>
                </div>
              )}
              {feedback && <div className={styles.feedbackInline}>{feedback}</div>}
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={disabled} title="Gửi" data-testid="chat-send-button">
              <span className={styles.visuallyHidden}>Gửi</span>
              <IconSend />
            </button>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
        data-testid="image-file-input"
      />
      <input
        ref={knowledgeFileRef}
        type="file"
        accept=".txt,.md,.csv,.log,.json,.py,.js,.yaml,.yml,.pdf,.docx,.pptx,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleKnowledgeUpload}
        data-testid="knowledge-file-input"
      />
    </form>
  );
}
