import styles from "./ArtifactCard.module.css";

const IconExternalLink = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.actionBtnIcon}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const IconCopy = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.actionBtnIcon}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function ArtifactCard({
  title,
  typeLabel,
  url,
  children,
}) {
  const handleCopyUrl = () => {
    if (url) {
      navigator.clipboard?.writeText(url).catch(() => {});
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {title && <span className={styles.title}>{title}</span>}
          {typeLabel && <span className={styles.typeBadge}>{typeLabel}</span>}
        </div>
        <div className={styles.actions}>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionBtn}
              title="Open in new tab"
            >
              <IconExternalLink />
              Open
            </a>
          )}
          {url && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleCopyUrl}
              title="Copy link"
            >
              <IconCopy />
            </button>
          )}
        </div>
      </div>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
