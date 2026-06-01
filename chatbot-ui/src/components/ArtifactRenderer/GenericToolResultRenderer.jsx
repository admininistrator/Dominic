import { useState } from "react";

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
    style={{ flexShrink: 0 }}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

/**
 * Validate a URL for external links — https only.
 */
function isSafeLinkUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function tryPrettyPrint(content) {
  if (typeof content !== "string") return content;
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

function getContentPreview(content, maxLength = 8000) {
  if (!content) return null;
  const pretty = tryPrettyPrint(content);
  if (pretty.length <= maxLength) return pretty;
  return pretty.slice(0, maxLength) + "\n\n... (content truncated)";
}

export default function GenericToolResultRenderer({ artifact }) {
  const [copied, setCopied] = useState(false);
  const displayContent = getContentPreview(artifact?.content);
  const hasUrl = Boolean(artifact?.url && typeof artifact.url === "string");

  const handleCopy = () => {
    if (!displayContent) return;
    navigator.clipboard?.writeText(artifact.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  if (!displayContent && !hasUrl && !artifact?.title) {
    return (
      <div style={{ padding: "4px 0", fontSize: "13px", color: "#94a3b8" }}>
        {artifact?.type ? `[${artifact.type}]` : "Artifact"} — no content
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {displayContent && (
        <div style={{ position: "relative" }}>
          <pre
            style={{
              margin: 0,
              padding: "12px 14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              overflow: "auto",
              maxHeight: "320px",
              fontSize: "12.5px",
              lineHeight: 1.55,
              fontFamily: "'Fira Mono', 'Cascadia Code', monospace",
              color: "#1e293b",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <code>{displayContent}</code>
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy content"}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              border: "1px solid #e5e7eb",
              borderRadius: "999px",
              background: "#fff",
              color: "#6b7280",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
              lineHeight: 1,
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f3f4f6";
              e.currentTarget.style.color = "#374151";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.color = "#6b7280";
            }}
          >
            <IconCopy />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {hasUrl && isSafeLinkUrl(artifact.url) && !displayContent && (
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "12px",
            color: "#2563eb",
            textDecoration: "none",
            wordBreak: "break-all",
          }}
        >
          View {artifact.title || "artifact"}
        </a>
      )}
    </div>
  );
}
