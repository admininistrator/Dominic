import { useState, useCallback, useEffect } from "react";

/**
 * Validate that a URL is safe to render as an image src.
 * Allows: https://, http://, data:image/...
 * Rejects: javascript:, file:, blob: (unless existing app pattern)
 */
function isSafeImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("https://") || url.startsWith("http://")) return true;
  if (url.startsWith("data:image/")) return true;
  return false;
}

export default function ImageArtifactRenderer({ artifact }) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [hasError, setHasError] = useState(false);

  const imageUrl = isSafeImageUrl(artifact?.url)
    ? artifact.url
    : isSafeImageUrl(artifact?.preview_url)
      ? artifact.preview_url
      : null;

  useEffect(() => {
    if (!showLightbox) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowLightbox(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showLightbox]);

  const handleImageError = useCallback(() => {
    setHasError(true);
  }, []);

  if (!imageUrl || hasError) {
    return (
      <div style={{ padding: "12px 0", color: "#9ca3af", fontSize: "13px" }}>
        {artifact?.title || "Image"} — could not load
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowLightbox(true)}
        style={{
          border: "none",
          padding: 0,
          background: "transparent",
          cursor: "zoom-in",
          borderRadius: "14px",
          overflow: "hidden",
          display: "inline-block",
          maxWidth: "100%",
        }}
      >
        <img
          src={imageUrl}
          alt={artifact?.title || "Artifact image"}
          onError={handleImageError}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "360px",
            borderRadius: "14px",
            objectFit: "contain",
            border: "1px solid #e5e7eb",
          }}
        />
      </button>

      {showLightbox && (
        <div
          onClick={() => setShowLightbox(false)}
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.76)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px",
          }}
        >
          <button
            type="button"
            onClick={() => setShowLightbox(false)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              width: "44px",
              height: "44px",
              border: "none",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontSize: "28px",
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
          <img
            src={imageUrl}
            alt={artifact?.title || "Artifact preview"}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: "min(92vw, 1080px)",
              maxHeight: "86vh",
              borderRadius: "28px",
              objectFit: "contain",
              boxShadow: "0 30px 80px rgba(15, 23, 42, 0.45)",
              background: "#fff",
            }}
          />
        </div>
      )}
    </>
  );
}
