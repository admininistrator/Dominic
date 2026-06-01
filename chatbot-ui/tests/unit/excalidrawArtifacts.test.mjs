import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildExcalidrawArtifactFromStreamEvent,
  parsePartialExcalidrawElements,
} from "../../src/utils/excalidrawArtifacts.js";

test("parsePartialExcalidrawElements handles complete JSON arrays", () => {
  const elements = parsePartialExcalidrawElements(JSON.stringify([
    { type: "cameraUpdate", x: 0, y: 0, width: 800, height: 500 },
    { type: "rectangle", id: "api", x: 20, y: 20, width: 120, height: 64 },
  ]));

  assert.equal(elements.length, 2);
  assert.equal(elements[0].type, "cameraUpdate");
  assert.equal(elements[1].id, "api");
});

test("parsePartialExcalidrawElements drops an incomplete trailing object", () => {
  const partial = '[{"type":"rectangle","id":"a","x":0,"y":0,"width":100,"height":50},{"type":"text","id":"b","x":';
  const elements = parsePartialExcalidrawElements(partial);

  assert.equal(elements.length, 1);
  assert.equal(elements[0].type, "rectangle");
});

test("buildExcalidrawArtifactFromStreamEvent accumulates delta payloads", () => {
  const artifact = buildExcalidrawArtifactFromStreamEvent("artifact_delta", {
    artifactId: "excalidraw_req_1",
    kind: "excalidraw",
    elementsPartial: '[{"type":"rectangle","id":"a","x":0,"y":0,"width":100,"height":50}]',
  });

  assert.equal(artifact.id, "excalidraw_req_1");
  assert.equal(artifact.metadata.streaming, true);
  assert.equal(JSON.parse(artifact.content).elements.length, 1);
});

test("buildExcalidrawArtifactFromStreamEvent handles invalid partial input without crashing", () => {
  const artifact = buildExcalidrawArtifactFromStreamEvent("artifact_delta", {
    artifactId: "excalidraw_req_2",
    kind: "excalidraw",
    elementsPartial: "not-json",
  });

  assert.equal(artifact.id, "excalidraw_req_2");
  assert.deepEqual(JSON.parse(artifact.content).elements, []);
});

