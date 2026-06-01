import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getArtifactKind,
  getMcpResourceSafety,
  getSafeMcpResourceUrl,
  isAllowlistedResourceUrl,
  isSameOriginUrl,
  resolveArtifactRendererKind,
  resolveArtifactTypeLabel,
} from "../../src/utils/artifactRouting.js";

test("artifact routing preserves native renderers and generic fallback", () => {
  assert.equal(getArtifactKind({ kind: " Excalidraw " }), "excalidraw");
  assert.equal(resolveArtifactRendererKind({ type: "excalidraw" }), "excalidraw");
  assert.equal(resolveArtifactRendererKind({ type: "image" }), "image");
  assert.equal(resolveArtifactRendererKind({ type: "svg" }), "image");
  assert.equal(resolveArtifactRendererKind({ type: "link" }), "link");
  assert.equal(resolveArtifactRendererKind({ type: "chart", content: "{}" }), "generic");
});

test("artifact labels use normalized artifact kind", () => {
  assert.equal(resolveArtifactTypeLabel({ type: "excalidraw" }), "EXCALIDRAW");
  assert.equal(resolveArtifactTypeLabel({ kind: "mcp_app" }), "MCP APP");
  assert.equal(resolveArtifactTypeLabel({ type: "generic_tool_result" }), "TOOL RESULT");
  assert.equal(resolveArtifactTypeLabel({ type: "custom_widget" }), "CUSTOM WIDGET");
});

test("MCP resources route before native/link/image fallback when render_mode requests an app", () => {
  assert.equal(
    resolveArtifactRendererKind({
      type: "link",
      url: "/mcp/apps/excalidraw",
      metadata: { render_mode: "mcp_resource" },
    }),
    "mcp_resource",
  );
  assert.equal(
    resolveArtifactRendererKind({
      kind: "mcp_app",
      metadata: { resource_url: "/mcp/apps/dashboard" },
    }),
    "mcp_resource",
  );
  assert.equal(
    resolveArtifactRendererKind({
      type: "excalidraw",
      metadata: {
        render_mode: "mcp_app",
        resource_url: "/mcp/apps/excalidraw/session-1",
      },
    }),
    "mcp_resource",
  );
});

test("MCP resource URL safety allows same-origin and blocks unsafe schemes/external origins", () => {
  const baseOrigin = "https://chat.example/app/";

  assert.equal(isSameOriginUrl("/mcp/apps/diagram", baseOrigin), true);
  assert.equal(isAllowlistedResourceUrl("/mcp/apps/diagram", [], baseOrigin), true);
  assert.equal(isAllowlistedResourceUrl("https://evil.example/app", [], baseOrigin), false);
  assert.equal(isAllowlistedResourceUrl("javascript:alert(1)", ["https://evil.example"], baseOrigin), false);
  assert.equal(isAllowlistedResourceUrl("https://apps.example/view", ["https://apps.example"], baseOrigin), true);
});

test("MCP resource safety helper resolves same-origin, allowlisted, and blocked URLs", () => {
  const baseOrigin = "https://chat.example";
  const sameOrigin = { kind: "mcp_app", metadata: { resource_url: "/mcp/apps/one" } };
  const allowlisted = {
    kind: "mcp_resource",
    metadata: {
      resource_url: "https://apps.example/whiteboard",
      allowed_origins: ["https://apps.example"],
    },
  };
  const unsafe = { kind: "mcp_resource", metadata: { resource_url: "https://evil.example/app" } };
  const script = { kind: "mcp_resource", metadata: { resource_url: "javascript:alert(1)" } };

  assert.equal(getMcpResourceSafety(sameOrigin, { baseOrigin }).isSafe, true);
  assert.equal(getSafeMcpResourceUrl(sameOrigin, { baseOrigin }), "/mcp/apps/one");
  assert.equal(getMcpResourceSafety(allowlisted, { baseOrigin }).isSafe, true);
  assert.equal(getMcpResourceSafety(unsafe, { baseOrigin }).isSafe, false);
  assert.equal(getSafeMcpResourceUrl(unsafe, { baseOrigin }), null);
  assert.equal(getMcpResourceSafety(script, { baseOrigin }).isSafe, false);
});
