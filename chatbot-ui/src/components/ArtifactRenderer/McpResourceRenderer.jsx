import { getMcpResourceSafety } from "../../utils/artifactRouting";

function resourceHostLabel(url) {
  if (!url || typeof url !== "string") return "resource";
  try {
    const base = typeof window !== "undefined" ? window.location?.href : undefined;
    return new URL(url, base).host || url;
  } catch {
    return url;
  }
}

function EmptyResourceMessage({ artifact }) {
  return (
    <div style={{ padding: "12px 0", color: "#64748b", fontSize: "13px" }}>
      {artifact?.title || "MCP app"} — no resource URL was provided.
    </div>
  );
}

function BlockedResourceMessage({ artifact, url }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "12px 14px",
        border: "1px solid #fde68a",
        borderRadius: "14px",
        background: "#fffbeb",
        color: "#92400e",
        fontSize: "13px",
        lineHeight: 1.45,
      }}
    >
      <strong>MCP app resource blocked</strong>
      <span>
        For safety, Dominic only embeds same-origin or explicitly allowlisted MCP
        app resources. The resource from {resourceHostLabel(url)} was not embedded.
      </span>
      {artifact?.content && (
        <span style={{ color: "#a16207" }}>
          The raw artifact details are still available in the message history.
        </span>
      )}
    </div>
  );
}

export default function McpResourceRenderer({ artifact }) {
  const safety = getMcpResourceSafety(artifact);
  const title = artifact?.title || "MCP app resource";

  if (!safety.url) {
    return <EmptyResourceMessage artifact={artifact} />;
  }

  if (!safety.isSafe) {
    return <BlockedResourceMessage artifact={artifact} url={safety.url} />;
  }

  const sandbox = safety.isSameOrigin
    ? "allow-downloads allow-forms allow-popups allow-same-origin allow-scripts"
    : "allow-downloads allow-forms allow-popups allow-scripts";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <iframe
        title={title}
        src={safety.url}
        sandbox={sandbox}
        referrerPolicy="no-referrer"
        loading="lazy"
        style={{
          width: "100%",
          minHeight: "420px",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          background: "#fff",
        }}
      />
      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
        Embedded MCP app resource ({safety.isSameOrigin ? "same-origin" : "allowlisted"}).
      </div>
    </div>
  );
}
