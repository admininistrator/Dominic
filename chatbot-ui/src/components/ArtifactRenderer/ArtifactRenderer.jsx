import ArtifactCard from "./ArtifactCard";
import ImageArtifactRenderer from "./ImageArtifactRenderer";
import LinkArtifactRenderer from "./LinkArtifactRenderer";
import ExcalidrawArtifactRenderer from "./ExcalidrawArtifactRenderer";
import GenericToolResultRenderer from "./GenericToolResultRenderer";

/**
 * ArtifactRenderer — router component that selects the correct sub-renderer
 * based on artifact.type.
 *
 * Props:
 *   artifact: object with { id, type, title, url, preview_url, metadata }
 *
 * Unknown or unsupported types fall back to GenericToolResultRenderer.
 * Returns null if artifact is null/undefined.
 */
export default function ArtifactRenderer({ artifact }) {
  if (!artifact) return null;

  const typeLabel = resolveTypeLabel(artifact.type);

  // Common type → specific renderer
  if (artifact.type === "image" || artifact.type === "svg") {
    return (
      <ArtifactCard title={artifact.title} typeLabel={typeLabel} url={artifact.url}>
        <ImageArtifactRenderer artifact={artifact} />
      </ArtifactCard>
    );
  }

  if (artifact.type === "link") {
    return (
      <ArtifactCard title={artifact.title} typeLabel={typeLabel} url={artifact.url}>
        <LinkArtifactRenderer artifact={artifact} />
      </ArtifactCard>
    );
  }

  if (artifact.type === "excalidraw") {
    return (
      <ExcalidrawArtifactRenderer
        key={artifact.id || artifact.url || artifact.type}
        artifact={artifact}
      />
    );
  }

  // Default / unknown / generic_tool_result: fall back to GenericToolResultRenderer
  return (
    <ArtifactCard
      title={artifact.title || null}
      typeLabel={typeLabel}
      url={artifact.url || null}
    >
      <GenericToolResultRenderer artifact={artifact} />
    </ArtifactCard>
  );
}

/**
 * Map artifact type to a human-readable label for the type badge.
 */
function resolveTypeLabel(type) {
  if (!type) return "UNKNOWN";
  switch (type) {
    case "image":
      return "IMAGE";
    case "svg":
      return "SVG";
    case "link":
      return "LINK";
    case "excalidraw":
      return "EXCALIDRAW";
    case "generic_tool_result":
      return "TOOL RESULT";
    default:
      return type.toUpperCase().replace(/_/g, " ");
  }
}
