import ArtifactCard from "./ArtifactCard";
import ImageArtifactRenderer from "./ImageArtifactRenderer";
import LinkArtifactRenderer from "./LinkArtifactRenderer";
import ExcalidrawArtifactRenderer from "./ExcalidrawArtifactRenderer";
import GenericToolResultRenderer from "./GenericToolResultRenderer";
import McpResourceRenderer from "./McpResourceRenderer";
import {
  getSafeMcpResourceUrl,
  resolveArtifactRendererKind,
  resolveArtifactTypeLabel,
} from "../../utils/artifactRouting";

/**
 * ArtifactRenderer — router component that selects the correct sub-renderer
 * based on normalized artifact kind/type.
 *
 * Native renderers stay first-class (notably Excalidraw). MCP app/resource
 * artifacts use a separate safe iframe extension point and unknown artifacts
 * continue to fall back to GenericToolResultRenderer.
 */
export default function ArtifactRenderer({ artifact }) {
  if (!artifact) return null;

  const rendererKind = resolveArtifactRendererKind(artifact);
  const typeLabel = resolveArtifactTypeLabel(artifact);

  if (rendererKind === "image") {
    return (
      <ArtifactCard title={artifact.title} typeLabel={typeLabel} url={artifact.url}>
        <ImageArtifactRenderer artifact={artifact} />
      </ArtifactCard>
    );
  }

  if (rendererKind === "link") {
    return (
      <ArtifactCard title={artifact.title} typeLabel={typeLabel} url={artifact.url}>
        <LinkArtifactRenderer artifact={artifact} />
      </ArtifactCard>
    );
  }

  if (rendererKind === "excalidraw") {
    return (
      <ExcalidrawArtifactRenderer
        key={artifact.id || artifact.url || artifact.type || artifact.kind}
        artifact={artifact}
      />
    );
  }

  if (rendererKind === "mcp_resource") {
    return (
      <ArtifactCard
        title={artifact.title || "MCP app"}
        typeLabel={typeLabel}
        url={getSafeMcpResourceUrl(artifact)}
      >
        <McpResourceRenderer artifact={artifact} />
      </ArtifactCard>
    );
  }

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
