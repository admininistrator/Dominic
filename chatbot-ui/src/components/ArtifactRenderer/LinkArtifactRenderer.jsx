/**
 * Validate a URL for external links.
 * Only https:// URLs are allowed for safety.
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

function truncateUrl(url, maxLength = 60) {
  if (!url || url.length <= maxLength) return url || "";
  return url.slice(0, maxLength - 3) + "...";
}

export default function LinkArtifactRenderer({ artifact }) {
  const safeUrl = isSafeLinkUrl(artifact?.url)
    ? artifact.url
    : null;

  if (!safeUrl) {
    return (
      <div style={{ padding: "4px 0", fontSize: "13px", color: "#9ca3af" }}>
        {artifact?.title || "Link"} — no valid URL
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: "12px",
          color: "#2563eb",
          textDecoration: "none",
          wordBreak: "break-all",
          lineHeight: 1.4,
        }}
        onMouseEnter={(e) => { e.target.style.textDecoration = "underline"; }}
        onMouseLeave={(e) => { e.target.style.textDecoration = "none"; }}
      >
        {truncateUrl(safeUrl)}
      </a>
      {artifact?.metadata && Object.keys(artifact.metadata).length > 0 && (
        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
          {artifact.metadata.tool_server && (
            <span>via {artifact.metadata.tool_server}</span>
          )}
        </div>
      )}
    </div>
  );
}
