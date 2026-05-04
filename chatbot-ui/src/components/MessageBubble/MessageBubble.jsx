import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DOMINIC_AVATAR_ICON, USER_AVATAR_ICON } from "../../assets/icons";
import { TYPEWRITER_INTERVAL_MS } from "../../config/uiConfig";
import styles from "./MessageBubble.module.css";

const IconThumbUp = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);
const IconThumbDown = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
  </svg>
);
const IconCopy = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconMore = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);
const IconEdit = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

function ExternalLink({ href, children, className, ...props }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}

export default function MessageBubble({
  role,
  content,
  sources = [],
  animate = false,
  images = [],
  documents = [],
  assistantMeta = null,
}) {
  const isUser = role === "user";
  const shouldAnimate = !isUser && animate;
  const normalizedImages = Array.isArray(images)
    ? images
        .map((image) => {
          if (typeof image === "string") return image;
          return image?.dataUri || image?.url || "";
        })
        .filter(Boolean)
    : [];
  const normalizedDocuments = Array.isArray(documents)
    ? documents
        .map((document) => {
          if (typeof document === "string") return { id: null, title: document };
          return {
            id: document?.id ?? document?.document_id ?? null,
            title: document?.title || document?.name || "",
          };
        })
        .filter((document) => document.title)
    : [];
  const [displayedContent, setDisplayedContent] = useState(
    shouldAnimate ? "" : content
  );
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    if (!shouldAnimate) return;

    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      setDisplayedContent(content.slice(0, idx));
      if (idx >= content.length) clearInterval(timer);
    }, TYPEWRITER_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [content, shouldAnimate]);

  useEffect(() => {
    if (!activeImage) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setActiveImage(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeImage]);

  const contentToRender = shouldAnimate ? displayedContent : content;

  const handleCopy = () => {
    navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const buildSourceKey = (source) => [
    source.source_type || "knowledge",
    source.document_id ?? source.url ?? source.title,
    source.chunk_id ?? source.rank ?? "src",
  ].join("-");

  return (
    <div
      className={`${styles.row} ${
        isUser ? styles.userRow : styles.assistantRow
      }`}
    >
      {/* Avatar */}
      <div
        className={`${styles.avatar} ${
          isUser ? styles.avatarUser : styles.avatarBot
        }`}
      >
        <img
          src={isUser ? USER_AVATAR_ICON : DOMINIC_AVATAR_ICON}
          alt=""
          className={styles.avatarImage}
        />
      </div>

      <div className={styles.body}>
        {/* Role label */}
        <div className={styles.roleLabel}>
          {isUser ? (
            <span className={styles.userLabel}>You</span>
          ) : (
            <span className={styles.botLabel}>
              Dominic <span className={styles.bolt}>●</span>
            </span>
          )}
          {isUser && (
            <button className={styles.editBtn} title="Chỉnh sửa">
              <IconEdit />
            </button>
          )}
        </div>
        {!isUser && assistantMeta?.display_text && (
          <div className={styles.assistantMetaLabel}>{assistantMeta.display_text}</div>
        )}

        {/* Content */}
        {isUser ? (
          <div className={styles.userBubble}>
            {normalizedDocuments.length > 0 && (
              <div className={styles.userDocuments}>
                {normalizedDocuments.map((document) => (
                  <span
                    key={`${document.id || document.title}-document-chip`}
                    className={styles.userDocumentChip}
                  >
                    {document.title}
                  </span>
                ))}
              </div>
            )}
            {normalizedImages.length > 0 && (
              <div className={styles.userImages}>
                {normalizedImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={styles.userImageBtn}
                    onClick={() => setActiveImage(image)}
                    title="Xem ảnh lớn"
                  >
                    <img
                      src={image}
                      alt={`attachment-${index + 1}`}
                      className={styles.userImage}
                    />
                  </button>
                ))}
              </div>
            )}
            <p className={styles.userText}>{contentToRender}</p>
          </div>
        ) : (
          <div className={`${styles.assistantCard} ${styles.markdown}`}>
            <ReactMarkdown
              components={{
                a: ({ ...props }) => <ExternalLink {...props} />,
              }}
            >
              {contentToRender}
            </ReactMarkdown>
          </div>
        )}

        {/* Action bar (assistant only) */}
        {!isUser && (
          <div className={styles.actionBar}>
            <div className={styles.actionGroup}>
              <button className={styles.actionBtn} title="Hữu ích">
                <IconThumbUp />
              </button>
              <button className={styles.actionBtn} title="Không hữu ích">
                <IconThumbDown />
              </button>
              <button
                className={styles.actionBtn}
                title={copied ? "Đã chép!" : "Sao chép"}
                onClick={handleCopy}
              >
                <IconCopy />
                {copied && <span className={styles.copiedTip}>Copied!</span>}
              </button>
              {Array.isArray(sources) && sources.length > 0 && (
                <button
                  className={styles.actionBtn}
                  onClick={() => setShowSources((v) => !v)}
                  title="Nguồn tham chiếu"
                  data-testid="toggle-sources-button"
                >
                  <IconMore />
                </button>
              )}
            </div>
            <button className={styles.regenerateBtn}>↺ Regenerate</button>
          </div>
        )}

        {/* Sources */}
        {!isUser && showSources && Array.isArray(sources) && sources.length > 0 && (
          <div className={styles.sourcesSection} data-testid="sources-section">
            <div className={styles.sourcesTitle}>Nguồn tham chiếu</div>
            {sources.map((source) => (
              <article
                key={buildSourceKey(source)}
                className={styles.sourceCard}
                data-testid="source-card"
              >
                <div className={styles.sourceHeader}>
                  <span>
                    [{source.rank || "?"}] {source.title}
                  </span>
                  {typeof source.score === "number" && (
                    <span>{Number(source.score).toFixed(3)}</span>
                  )}
                </div>
                <div className={styles.sourceMeta}>
                  {source.source_type === "web"
                    ? `${source.domain || "web"}${source.url ? " · nguồn ngoài" : ""}`
                    : `doc #${source.document_id} · chunk #${source.chunk_id}`}
                </div>
                {source.url && (
                  <ExternalLink href={source.url} className={styles.sourceLink}>
                    {source.url}
                  </ExternalLink>
                )}
                <div className={styles.sourceSnippet}>{source.snippet}</div>
              </article>
            ))}
          </div>
        )}

        {activeImage && (
          <div className={styles.imageLightbox} onClick={() => setActiveImage(null)} role="presentation">
            <button
              type="button"
              className={styles.imageLightboxClose}
              onClick={() => setActiveImage(null)}
              aria-label="Đóng xem ảnh"
            >
              ×
            </button>
            <img
              src={activeImage}
              alt="attachment preview"
              className={styles.imageLightboxContent}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
