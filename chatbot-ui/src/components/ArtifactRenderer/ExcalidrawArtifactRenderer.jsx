import { Suspense, lazy, useState, useEffect, useCallback, useRef } from "react";
import styles from "./ExcalidrawArtifactRenderer.module.css";
import { buildExcalidrawScene, parsePartialExcalidrawElements } from "../../utils/excalidrawArtifacts";
import "@excalidraw/excalidraw/index.css";

const ExcalidrawEditor = lazy(() => import("@excalidraw/excalidraw").then((module) => ({ default: module.Excalidraw })));

/* ── Shared icon SVGs ── */

const IconExcalidraw = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.iconSvg}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

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

const IconDownload = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
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

const IconPlaceholder = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.placeholderIcon}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    <circle cx="18" cy="5" r="0.5" />
  </svg>
);

/* ── URL Validation ── */

/**
 * Validate a URL for Excalidraw/open actions.
 * Enforces https and optionally checks against excalidraw.com domain.
 */
function isSafeExcalidrawUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    // Domain allowlist: excalidraw.com and subdomains, plus other trusted
    if (
      parsed.hostname === "excalidraw.com" ||
      parsed.hostname.endsWith(".excalidraw.com")
    ) {
      return true;
    }
    // Accept any https link as safe fallback (the backend sanitization is primary gate)
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an image URL for preview.
 * Allows https:, http:, data:image/ — same as ImageArtifactRenderer.
 */
function isSafePreviewUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("https://") || url.startsWith("http://")) return true;
  if (url.startsWith("data:image/")) return true;
  return false;
}

/* ── Component ── */

function parseExcalidrawScene(content) {
  if (!content || typeof content !== "string") return null;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return buildExcalidrawScene(parsed);
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.elements)) {
      return { ...parsed, elements: parsePartialExcalidrawElements(parsed.elements) };
    }
  } catch {
    const elements = parsePartialExcalidrawElements(content);
    return elements.length ? buildExcalidrawScene(elements) : null;
  }
  return null;
}

function isRenderableElement(element) {
  const renderableTypes = new Set(["rectangle", "ellipse", "diamond", "line", "arrow", "text", "freedraw"]);
  return Boolean(
    element &&
      typeof element === "object" &&
      !element.isDeleted &&
      renderableTypes.has(element.type) &&
      typeof element.x === "number" &&
      typeof element.y === "number"
  );
}

function getElementBounds(element) {
  if (Array.isArray(element.points) && element.points.length > 0) {
    const xs = element.points.map((point) => element.x + Number(point?.[0] || 0));
    const ys = element.points.map((point) => element.y + Number(point?.[1] || 0));
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  const width = Number(element.width || 0);
  const height = Number(element.height || 0);
  return {
    minX: Math.min(element.x, element.x + width),
    minY: Math.min(element.y, element.y + height),
    maxX: Math.max(element.x, element.x + width),
    maxY: Math.max(element.y, element.y + height),
  };
}

function buildViewBox(elements) {
  const bounds = elements.map(getElementBounds);
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  const padding = 48;
  const width = Math.max(320, maxX - minX + padding * 2);
  const height = Math.max(220, maxY - minY + padding * 2);
  return `${minX - padding} ${minY - padding} ${width} ${height}`;
}

function getCameraViewBox(scene, fallbackElements) {
  const allElements = Array.isArray(scene?.elements) ? scene.elements : [];
  const camera = [...allElements]
    .reverse()
    .find((element) => (
      element?.type === "cameraUpdate" &&
      typeof element.x === "number" &&
      typeof element.y === "number" &&
      typeof element.width === "number" &&
      typeof element.height === "number"
    ));
  if (camera) {
    return `${camera.x} ${camera.y} ${Math.max(1, camera.width)} ${Math.max(1, camera.height)}`;
  }
  return buildViewBox(fallbackElements);
}

function splitTextLines(text, maxChars) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 8);
}

function InlineExcalidrawPreview({ scene, className = "", animate = false }) {
  const elements = Array.isArray(scene?.elements)
    ? scene.elements.filter(isRenderableElement)
    : [];

  if (elements.length === 0) return null;

  const viewBox = getCameraViewBox(scene, elements);
  const background =
    scene?.appState?.viewBackgroundColor &&
    typeof scene.appState.viewBackgroundColor === "string"
      ? scene.appState.viewBackgroundColor
      : "#ffffff";

  return (
    <svg
      className={`${styles.inlineSvg} ${className}`}
      viewBox={viewBox}
      role="img"
      aria-label="Excalidraw preview"
      style={{ background }}
    >
      <defs>
        <marker
          id="excalidraw-arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
        </marker>
      </defs>
      {elements.map((element, index) => (
        <InlineElement
          key={element.id || `${element.type}-${index}`}
          element={element}
          animated={animate}
          animationIndex={index}
        />
      ))}
    </svg>
  );
}

function getEditableElements(scene) {
  return Array.isArray(scene?.elements)
    ? scene.elements.filter((element) => element?.type !== "cameraUpdate")
    : [];
}

function InlineElement({ element, animated = false, animationIndex = 0 }) {
  const stroke = element.strokeColor || "#1e1e1e";
  const rawFill = element.backgroundColor || "transparent";
  const fill = rawFill === "transparent" ? "none" : rawFill;
  const strokeWidth = Math.max(1, Number(element.strokeWidth || 1.5));
  const opacity = Math.max(0, Math.min(1, Number(element.opacity ?? 100) / 100));
  const animationStyle = animated
    ? { animationDelay: `${Math.min(animationIndex * 110, 2400)}ms` }
    : undefined;
  const common = {
    stroke,
    fill,
    strokeWidth,
    opacity,
    className: animated ? styles.fadeElement : undefined,
    style: animationStyle,
    strokeDasharray: element.strokeStyle === "dashed" ? "8 6" : undefined,
  };
  const label = element.label && typeof element.label === "object"
    ? element.label
    : null;

  if (element.type === "rectangle") {
    const width = Math.max(1, Number(element.width || 1));
    const height = Math.max(1, Number(element.height || 1));
    return (
      <>
        <rect
          x={element.x}
          y={element.y}
          width={width}
          height={height}
          rx={element.roundness ? 12 : 0}
          {...common}
        />
        <InlineLabel
          label={label}
          x={element.x}
          y={element.y}
          width={width}
          height={height}
          stroke={stroke}
          animated={animated}
          animationStyle={animationStyle}
        />
      </>
    );
  }

  if (element.type === "ellipse") {
    const width = Math.max(1, Number(element.width || 1));
    const height = Math.max(1, Number(element.height || 1));
    return (
      <>
        <ellipse
          cx={element.x + width / 2}
          cy={element.y + height / 2}
          rx={width / 2}
          ry={height / 2}
          {...common}
        />
        <InlineLabel
          label={label}
          x={element.x}
          y={element.y}
          width={width}
          height={height}
          stroke={stroke}
          animated={animated}
          animationStyle={animationStyle}
        />
      </>
    );
  }

  if (element.type === "diamond") {
    const width = Math.max(1, Number(element.width || 1));
    const height = Math.max(1, Number(element.height || 1));
    const points = [
      [element.x + width / 2, element.y],
      [element.x + width, element.y + height / 2],
      [element.x + width / 2, element.y + height],
      [element.x, element.y + height / 2],
    ].map((point) => point.join(",")).join(" ");
    return (
      <>
        <polygon points={points} {...common} />
        <InlineLabel
          label={label}
          x={element.x}
          y={element.y}
          width={width}
          height={height}
          stroke={stroke}
          animated={animated}
          animationStyle={animationStyle}
        />
      </>
    );
  }

  if (element.type === "line" || element.type === "arrow") {
    const points = Array.isArray(element.points)
      ? element.points
      : [[0, 0], [element.width || 0, element.height || 0]];
    const polylinePoints = points
      .map((point) => `${element.x + Number(point?.[0] || 0)},${element.y + Number(point?.[1] || 0)}`)
      .join(" ");
    return (
      <>
        <polyline
          className={animated ? styles.drawLine : undefined}
          style={animationStyle}
          points={polylinePoints}
          stroke={stroke}
          fill="none"
          strokeWidth={strokeWidth}
          opacity={opacity}
          strokeDasharray={element.strokeStyle === "dashed" ? "8 6" : undefined}
          markerEnd={element.type === "arrow" || element.endArrowhead ? "url(#excalidraw-arrowhead)" : undefined}
        />
        <InlineLabel
          label={label}
          x={element.x}
          y={element.y - 24}
          width={Number(element.width || 0)}
          height={Math.max(24, Number(element.height || 0) + 24)}
          stroke={stroke}
          animated={animated}
          animationStyle={animationStyle}
        />
      </>
    );
  }

  if (element.type === "text") {
    const fontSize = Math.max(10, Number(element.fontSize || 16));
    const width = Math.max(40, Number(element.width || 120));
    const height = Math.max(fontSize, Number(element.height || fontSize * 1.25));
    const maxChars = Math.max(8, Math.floor(width / Math.max(7, fontSize * 0.55)));
    const lines = splitTextLines(element.text || element.originalText || "", maxChars);
    const lineHeight = fontSize * Number(element.lineHeight || 1.25);
    const startY = element.y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
    const textAnchor = element.textAlign === "left" ? "start" : element.textAlign === "right" ? "end" : "middle";
    const textX =
      textAnchor === "start"
        ? element.x
        : textAnchor === "end"
          ? element.x + width
          : element.x + width / 2;

    return (
      <text
        className={animated ? styles.fadeElement : undefined}
        style={animationStyle}
        x={textX}
        y={startY}
        fill={stroke}
        fontSize={fontSize}
        fontFamily="Virgil, Segoe UI, sans-serif"
        textAnchor={textAnchor}
        dominantBaseline="middle"
        opacity={opacity}
      >
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={textX} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  }

  if (element.type === "freedraw" && Array.isArray(element.points)) {
    const pathData = element.points
      .map((point, index) => {
        const x = element.x + Number(point?.[0] || 0);
        const y = element.y + Number(point?.[1] || 0);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return (
      <path
        className={animated ? styles.drawLine : undefined}
        style={animationStyle}
        d={pathData}
        stroke={stroke}
        fill="none"
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
  }

  return null;
}

function InlineLabel({ label, x, y, width, height, stroke, animated, animationStyle }) {
  if (!label?.text) return null;
  const fontSize = Math.max(10, Number(label.fontSize || 16));
  const text = String(label.text || "");
  const labelWidth = Math.max(40, Math.abs(Number(width || 120)));
  const maxChars = Math.max(8, Math.floor(labelWidth / Math.max(7, fontSize * 0.55)));
  const lines = splitTextLines(text, maxChars);
  const lineHeight = fontSize * 1.25;
  const textX = x + Number(width || 0) / 2;
  const textY = y + Number(height || 0) / 2 - ((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      className={animated ? styles.fadeElement : undefined}
      style={animationStyle}
      x={textX}
      y={textY}
      fill={label.strokeColor || stroke}
      fontSize={fontSize}
      fontFamily="Virgil, Segoe UI, sans-serif"
      textAnchor="middle"
      dominantBaseline="middle"
      pointerEvents="none"
    >
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={textX} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export default function ExcalidrawArtifactRenderer({ artifact }) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);

  const safeUrl = isSafeExcalidrawUrl(artifact?.url) ? artifact.url : null;
  const previewUrl = isSafePreviewUrl(artifact?.preview_url)
    ? artifact.preview_url
    : null;
  const hasContent = Boolean(
    artifact?.content && typeof artifact.content === "string"
  );
  const isJsonContent =
    hasContent && isLikelyJson(artifact.content);
  const inlineScene = isJsonContent ? parseExcalidrawScene(artifact.content) : null;
  const hasInlinePreview = Boolean(inlineScene?.elements?.length);
  const isStreaming = artifact?.metadata?.streaming === true || artifact?.metadata?.status === "streaming";
  const artifactError = artifact?.metadata?.status === "error" ? artifact?.metadata?.error : null;

  // Toast management
  const showToast = useCallback((message) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 1800);
  }, []);

  // Cleanup toast timer
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Escape key for lightbox
  useEffect(() => {
    if (!showLightbox) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") setShowLightbox(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showLightbox]);

  // Open in new tab
  const handleOpen = useCallback(() => {
    if (safeUrl) {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    }
  }, [safeUrl]);

  // Download as .excalidraw file
  const handleDownload = useCallback(() => {
    if (!hasContent) return;
    try {
      // For JSON content, pretty-print; for text, use as-is
      let blobContent;
      let mimeType;
      if (isJsonContent) {
        const parsed = JSON.parse(artifact.content);
        blobContent = JSON.stringify(parsed, null, 2);
        mimeType = "application/json";
      } else {
        blobContent = artifact.content;
        mimeType = "text/plain";
      }
      const blob = new Blob([blobContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${artifact.title || "diagram"}.excalidraw`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast("Downloaded!");
    } catch {
      showToast("Download failed");
    }
  }, [hasContent, isJsonContent, artifact, showToast]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(() => {
    if (!safeUrl) return;
    navigator.clipboard
      ?.writeText(safeUrl)
      .then(() => showToast("Link copied!"))
      .catch(() => showToast("Copy failed"));
  }, [safeUrl, showToast]);

  const title = artifact?.title || "Excalidraw";

  return (
    <div className={styles.card}>
      {/* Header: icon + title + subtitle */}
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <IconExcalidraw />
        </div>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{title}</span>
          {artifact?.metadata?.tool_server && (
            <span className={styles.subtitle}>
              via {artifact.metadata.tool_server}
            </span>
          )}
          {isStreaming && !artifactError && (
            <span className={styles.subtitle}>Streaming diagram...</span>
          )}
          {artifactError && (
            <span className={styles.errorText}>{artifactError}</span>
          )}
        </div>
      </div>

      {/* Preview area */}
      {previewUrl && !previewError ? (
        <div className={styles.previewWrap}>
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => setShowLightbox(true)}
            aria-label="View preview"
          >
            <img
              src={previewUrl}
              alt={title}
              className={styles.previewImg}
              onError={() => setPreviewError(true)}
            />
          </button>
        </div>
      ) : hasInlinePreview ? (
        <div className={styles.previewWrap}>
          <button
            type="button"
            className={`${styles.previewBtn} ${styles.inlinePreviewBtn}`}
            onClick={() => setShowLightbox(true)}
            aria-label="View Excalidraw preview"
          >
            <InlineExcalidrawPreview scene={inlineScene} animate />
          </button>
          {isStreaming && <div className={styles.streamingBadge}>Streaming</div>}
        </div>
      ) : (
        <div className={styles.placeholder}>
          <IconPlaceholder />
          <span className={styles.placeholderText}>
            {previewError
              ? "Preview could not be loaded"
              : "Excalidraw whiteboard"}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className={styles.actions}>
        {safeUrl && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={handleOpen}
            aria-label={`Open ${title} in Excalidraw`}
          >
            <IconExternalLink />
            Open in Excalidraw
          </button>
        )}
        {hasContent && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleDownload}
            aria-label={`Download ${title}`}
          >
            <IconDownload />
            Download
          </button>
        )}
        {safeUrl && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleCopyLink}
            aria-label={`Copy ${title} link`}
          >
            <IconCopy />
            Copy Link
          </button>
        )}
      </div>

      {/* Lightbox */}
      {showLightbox && (previewUrl || hasInlinePreview) && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setShowLightbox(false)}
          role="presentation"
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setShowLightbox(false)}
            aria-label="Close preview"
          >
            ×
          </button>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={title}
              className={styles.lightboxImg}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className={styles.lightboxScene}
              onClick={(e) => e.stopPropagation()}
              role="presentation"
            >
              <Suspense fallback={<InlineExcalidrawPreview scene={inlineScene} className={styles.lightboxSvg} />}>
                <ExcalidrawEditor
                  initialData={{
                    elements: getEditableElements(inlineScene),
                    appState: {
                      viewBackgroundColor: inlineScene?.appState?.viewBackgroundColor || "#ffffff",
                    },
                    files: inlineScene?.files || {},
                  }}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {/* Toast overlay */}
      {toastMessage && (
        <div className={styles.copiedToast} role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

/**
 * Quick check if a string looks like JSON.
 */
function isLikelyJson(str) {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}
