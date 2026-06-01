const SAME_ORIGIN_RESOURCE_SCHEMES = new Set(["http:", "https:"]);

function normalizedType(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeOriginList(value) {
  if (!value) return [];
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (value instanceof Set) {
    return Array.from(value).map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [];
}

function globalAllowedMcpResourceOrigins() {
  if (typeof window === "undefined") return [];
  return normalizeOriginList(
    window.__DOMINIC_MCP_RESOURCE_ORIGINS__
      || window.__MCP_RESOURCE_ALLOWED_ORIGINS__
      || [],
  );
}

export function getArtifactKind(artifact) {
  if (!artifact || typeof artifact !== "object") return "unknown";
  return normalizedType(
    artifact.kind
      || artifact.type
      || artifact.metadata?.kind
      || artifact.metadata?.artifact_kind
      || "generic_tool_result",
  );
}

export function isSameOriginUrl(url, baseOrigin) {
  if (!url || typeof url !== "string") return false;
  try {
    const base = baseOrigin
      ? new URL(baseOrigin)
      : (typeof window !== "undefined" && window.location ? window.location : null);
    if (!base) return false;
    const parsed = new URL(url, base.href || base.origin);
    return SAME_ORIGIN_RESOURCE_SCHEMES.has(parsed.protocol) && parsed.origin === base.origin;
  } catch {
    return false;
  }
}

export function isAllowlistedResourceUrl(url, allowedOrigins = [], baseOrigin) {
  if (!url || typeof url !== "string") return false;
  try {
    const base = baseOrigin
      ? new URL(baseOrigin)
      : (typeof window !== "undefined" && window.location ? window.location : null);
    const parsed = new URL(url, base?.href || undefined);
    if (!SAME_ORIGIN_RESOURCE_SCHEMES.has(parsed.protocol)) return false;
    if (base && parsed.origin === base.origin) return true;
    return normalizeOriginList(allowedOrigins).some((origin) => {
      try {
        return parsed.origin === new URL(origin).origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function getMcpResourceUrl(artifact) {
  if (!artifact || typeof artifact !== "object") return null;
  const metadata = artifact.metadata || {};
  return metadata.resource_url
    || metadata.resourceUrl
    || metadata.uri
    || metadata.href
    || artifact.resource_url
    || artifact.url
    || null;
}

export function getMcpResourceAllowedOrigins(artifact, extraAllowedOrigins = []) {
  const metadata = artifact?.metadata || {};
  const configured = [
    ...normalizeOriginList(metadata.allowed_origins),
    ...normalizeOriginList(metadata.allowedOrigins),
    ...normalizeOriginList(metadata.resource_allowed_origins),
    ...normalizeOriginList(metadata.resourceAllowedOrigins),
    ...normalizeOriginList(metadata.mcp_resource_allowed_origins),
    ...normalizeOriginList(metadata.mcpResourceAllowedOrigins),
    ...normalizeOriginList(artifact?.allowed_origins),
    ...normalizeOriginList(artifact?.allowedOrigins),
    ...normalizeOriginList(extraAllowedOrigins),
    ...globalAllowedMcpResourceOrigins(),
  ];
  return [...new Set(configured)];
}

export function isMcpResourceArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") return false;
  const kind = getArtifactKind(artifact);
  const renderMode = normalizedType(artifact.metadata?.render_mode || artifact.metadata?.renderMode);
  return kind === "mcp_resource"
    || kind === "mcp_app"
    || renderMode === "mcp_resource"
    || renderMode === "mcp_app"
    || Boolean(artifact.metadata?.mcp_resource || artifact.metadata?.mcp_app_resource);
}

export function getMcpResourceSafety(artifact, options = {}) {
  const url = getMcpResourceUrl(artifact);
  const allowedOrigins = getMcpResourceAllowedOrigins(artifact, options.allowedOrigins || []);
  const baseOrigin = options.baseOrigin;
  return {
    url,
    isSafe: isAllowlistedResourceUrl(url, allowedOrigins, baseOrigin),
    isSameOrigin: isSameOriginUrl(url, baseOrigin),
    allowedOrigins,
  };
}

export function getSafeMcpResourceUrl(artifact, options = {}) {
  const safety = getMcpResourceSafety(artifact, options);
  return safety.isSafe ? safety.url : null;
}

export function resolveArtifactRendererKind(artifact) {
  const kind = getArtifactKind(artifact);
  if (isMcpResourceArtifact(artifact)) return "mcp_resource";
  if (kind === "excalidraw") return "excalidraw";
  if (kind === "image" || kind === "svg") return "image";
  if (kind === "link") return "link";
  return "generic";
}

export function resolveArtifactTypeLabel(artifact) {
  const kind = getArtifactKind(artifact);
  switch (kind) {
    case "image":
      return "IMAGE";
    case "svg":
      return "SVG";
    case "link":
      return "LINK";
    case "excalidraw":
      return "EXCALIDRAW";
    case "mcp_resource":
    case "mcp_app":
      return "MCP APP";
    case "generic_tool_result":
      return "TOOL RESULT";
    default:
      return kind.toUpperCase().replace(/_/g, " ");
  }
}
