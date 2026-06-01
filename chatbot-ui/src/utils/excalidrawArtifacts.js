const DRAWABLE_TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "arrow", "line"]);
const SUPPORTED_TYPES = new Set([...DRAWABLE_TYPES, "cameraUpdate"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeElement(element, index) {
  if (!isPlainObject(element) || !SUPPORTED_TYPES.has(element.type)) return null;

  if (element.type === "cameraUpdate") {
    return {
      type: "cameraUpdate",
      x: normalizeNumber(element.x),
      y: normalizeNumber(element.y),
      width: Math.max(1, Math.abs(normalizeNumber(element.width, 800))),
      height: Math.max(1, Math.abs(normalizeNumber(element.height, 500))),
    };
  }

  const normalized = {
    ...element,
    id: String(element.id || `partial-${index}`),
    x: normalizeNumber(element.x),
    y: normalizeNumber(element.y),
    width: normalizeNumber(element.width),
    height: normalizeNumber(element.height),
  };

  if (element.type === "text") {
    const text = typeof element.text === "string" ? element.text : String(element.originalText || "");
    if (!text.trim()) return null;
    normalized.text = text;
    normalized.originalText = normalized.originalText || text;
  }

  if ((element.type === "arrow" || element.type === "line") && !Array.isArray(element.points)) {
    normalized.points = [[0, 0], [normalized.width, normalized.height]];
  }

  return normalized;
}

export function normalizeExcalidrawElements(elements) {
  if (!Array.isArray(elements)) return [];
  return elements
    .map((element, index) => normalizeElement(element, index))
    .filter(Boolean);
}

function extractElements(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value) && Array.isArray(value.elements)) return value.elements;
  return [];
}

export function parsePartialExcalidrawElements(input) {
  if (Array.isArray(input)) return normalizeExcalidrawElements(input);
  if (!input || typeof input !== "string") return [];

  try {
    return normalizeExcalidrawElements(extractElements(JSON.parse(input)));
  } catch {
    // Fall through to boundary scanning.
  }

  const raw = input;
  const elementsIndex = raw.indexOf('"elements"');
  const arrayStart = raw.indexOf("[", elementsIndex >= 0 ? elementsIndex : 0);
  if (arrayStart < 0) return [];

  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let index = arrayStart; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}") {
      if (depth <= 0) continue;
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          const parsed = JSON.parse(raw.slice(start, index + 1));
          if (isPlainObject(parsed)) objects.push(parsed);
        } catch {
          // Ignore malformed object fragments.
        }
        start = -1;
      }
    }
  }

  return normalizeExcalidrawElements(objects);
}

export function buildExcalidrawArtifactFromStreamEvent(eventName, data) {
  if (!data || typeof data !== "object") return null;
  if (data.artifact && typeof data.artifact === "object" && data.artifact.type === "excalidraw") {
    return data.artifact;
  }

  const artifactId = data.artifactId || data.artifact?.id;
  const artifactMeta = data.artifact || {};
  const title = artifactMeta.title || "Excalidraw diagram";
  if (!artifactId && eventName !== "artifact_start") return null;

  if (eventName === "artifact_start") {
    const id = artifactMeta.id || artifactId;
    if (!id) return null;
    return {
      id,
      type: "excalidraw",
      title,
      content: JSON.stringify(buildExcalidrawScene([])),
      metadata: {
        streaming: true,
        status: "streaming",
        render_mode: "native_excalidraw_stream",
      },
    };
  }

  if (eventName === "artifact_error") {
    return {
      id: artifactId,
      type: "excalidraw",
      title,
      content: JSON.stringify(buildExcalidrawScene([])),
      metadata: {
        streaming: false,
        status: "error",
        error: data.message || "Unable to render artifact.",
        render_mode: "native_excalidraw_stream",
      },
    };
  }

  const elements = eventName === "artifact_done"
    ? normalizeExcalidrawElements(data.elements)
    : parsePartialExcalidrawElements(data.elementsPartial);

  return {
    id: artifactId,
    type: "excalidraw",
    title,
    content: JSON.stringify(buildExcalidrawScene(elements)),
    metadata: {
      ...(data.metadata || {}),
      streaming: eventName !== "artifact_done",
      status: eventName === "artifact_done" ? "done" : "streaming",
      render_mode: "native_excalidraw_stream",
      element_count: elements.length,
    },
  };
}

export function buildExcalidrawScene(elements) {
  return {
    type: "excalidraw",
    version: 2,
    source: "DominicChatbot",
    elements: normalizeExcalidrawElements(elements),
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  };
}

