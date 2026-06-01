import { AnimatePresence, motion as Motion } from "framer-motion";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import AppLayout from "./components/App/App";
import "./App.css";
import {
  adminResetPassword,
  changePassword,
  getMe,
  listUsers,
  login,
  logout,
  register,
  resetPassword,
  setUserRole,
} from "./service/authApi";
import {
  createSession,
  deleteSession,
  getChatModelCatalog,
  getSessionMessages,
  getSessions,
  getUsage,
  sendChatMessageStream,
} from "./service/chatApi";
import { buildExcalidrawArtifactFromStreamEvent } from "./utils/excalidrawArtifacts";
import {
  deleteKnowledgeDocument,
  getAuditLogs,
  getCostMetrics,
  getKnowledgeChunks,
  getKnowledgeAnalytics,
  getKnowledgeJobs,
  ingestKnowledgeText,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  searchKnowledge,
  uploadKnowledgeFile,
} from "./service/knowledgeApi";
import { clearAuthSession, getStoredAuthToken, getStoredRefreshToken, refreshAuthSession, setAuthSession } from "./service/apiClient";
import {
  AVAILABLE_CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  SUPPORTED_CHAT_MODELS,
  configureChatModelCatalog,
  getChatModelDisplayText,
  getDefaultThinkingEffortForModel,
  normalizeThinkingEffortForModel,
  supportsThinkingEffort,
} from "./config/uiConfig";
import "./styles/globals.css";
import { loadAndApplyDesign } from "./utils/themeParser";

const AdminPanel = lazy(() => import("./components/AdminPanel/AdminPanel"));
const ChatInput = lazy(() => import("./components/ChatInput/ChatInput"));
const ChatWindow = lazy(() => import("./components/ChatWindow/ChatWindow"));
const KnowledgePanel = lazy(() => import("./components/KnowledgePanel/KnowledgePanel"));
const Login = lazy(() => import("./components/Login/Login"));

const VIEW_CHAT = "chat";
const VIEW_KNOWLEDGE = "knowledge";
const VIEW_ADMIN = "admin";
const THEME_STORAGE_KEY = "dominic-ui-theme";
const CHAT_MODEL_STORAGE_KEY = "dominic-chat-model";
const CHAT_MODEL_EFFORT_STORAGE_KEY = "dominic-chat-model-effort";
const AUTO_SESSION_TITLE_PATTERN = /^(new chat|chat\s+\d+)$/i;
const WORKSPACE_ENTRY_MIN_MS = 1000;
const SCREEN_STAGE_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] };
const SESSION_MESSAGES_PAGE_SIZE = 30;

function createEmptyMessagePagination(limit = SESSION_MESSAGES_PAGE_SIZE) {
  return {
    hasMore: false,
    nextBeforeId: null,
    limit,
  };
}

function LazyViewFallback({ message }) {
  return <div aria-live="polite">{message}</div>;
}

function getScreenStageVariants(stage, direction) {
  if (stage === "login") {
    if (direction === "backward") {
      return {
        initial: { opacity: 0, x: -28, y: 8, scale: 0.992, filter: "blur(9px)" },
        animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, x: 22, y: -10, scale: 1.006, filter: "blur(8px)" },
      };
    }

    return {
      initial: { opacity: 0, y: 14, scale: 0.988, filter: "blur(8px)" },
      animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
      exit: { opacity: 0, y: -14, scale: 1.01, filter: "blur(10px)" },
    };
  }

  if (stage === "entry") {
    return direction === "backward"
      ? {
          initial: { opacity: 0, x: -18, y: 12, scale: 0.994, filter: "blur(8px)" },
          animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" },
          exit: { opacity: 0, x: 18, y: -12, scale: 1.006, filter: "blur(8px)" },
        }
      : {
          initial: { opacity: 0, y: 18, scale: 0.992, filter: "blur(7px)" },
          animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
          exit: { opacity: 0, y: -16, scale: 1.008, filter: "blur(8px)" },
        };
  }

  return direction === "backward"
    ? {
        initial: { opacity: 0, x: 26, y: 10, scale: 0.994, filter: "blur(8px)" },
        animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, x: -26, y: -10, scale: 1.006, filter: "blur(7px)" },
      }
    : {
        initial: { opacity: 0, y: 20, scale: 0.994, filter: "blur(8px)" },
        animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, y: -12, scale: 1.006, filter: "blur(7px)" },
      };
}

const EMPTY_USAGE = {
  username: "",
  max_tokens_per_day: 10000,
  total_token_used: 0,
  total_input_tokens_used: 0,
  total_output_tokens_used: 0,
  lifetime_total_token_used: 0,
  lifetime_total_input_tokens_used: 0,
  lifetime_total_output_tokens_used: 0,
  rolling_window_hours: 2,
  rolling_total_token_used: 0,
  rolling_input_tokens_used: 0,
  rolling_output_tokens_used: 0,
};

const EMPTY_KNOWLEDGE_SEARCH = {
  query: "",
  top_k: 0,
  returned: 0,
  retrieval_id: null,
  results: [],
};

function extractErrorMessage(error, fallback = "Co loi khi goi API chat.") {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return status ? `[${status}] ${detail}` : detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first?.msg) {
      return status ? `[${status}] ${first.msg}` : first.msg;
    }
  }

  if (error?.code === "ECONNABORTED") {
    return "Timeout khi cho backend/AI tra loi. Thu rut ngan prompt hoac tang API timeout.";
  }

  if (!error?.response) {
    return "Khong ket noi duoc backend (kiem tra server FastAPI, URL, CORS).";
  }

  return status ? `[${status}] ${fallback}` : fallback;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function getInitialChatModel() {
  if (typeof window === "undefined") return DEFAULT_CHAT_MODEL;

  const storedModel = window.localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
  if (storedModel && AVAILABLE_CHAT_MODELS.includes(storedModel)) {
    return storedModel;
  }

  return DEFAULT_CHAT_MODEL;
}

function getInitialThinkingEffortByModel() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(CHAT_MODEL_EFFORT_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([modelName]) => AVAILABLE_CHAT_MODELS.includes(modelName))
        .map(([modelName, effort]) => [modelName, normalizeThinkingEffortForModel(modelName, effort)])
        .filter(([, effort]) => Boolean(effort))
    );
  } catch {
    return {};
  }
}

function normalizeMessageImages(images) {
  return Array.isArray(images)
    ? images
        .map((image) => {
          if (typeof image === "string") return image;
          return image?.dataUri || image?.url || "";
        })
        .filter(Boolean)
    : [];
}

function normalizeMessageDocuments(documents) {
  return Array.isArray(documents)
    ? documents
        .map((document) => {
          if (typeof document === "string") {
            return { id: null, title: document, session_id: null };
          }
          return {
            id: document?.id ?? document?.document_id ?? null,
            title: document?.title || document?.name || "",
            session_id: document?.session_id ?? document?.sessionId ?? null,
          };
        })
        .filter((document) => document.title)
    : [];
}

function normalizeAssistantMeta(meta) {
  if (!meta || typeof meta !== "object") return null;

  const model = typeof meta.model === "string" ? meta.model.trim() : "";
  const reasoningEffort = typeof meta.reasoning_effort === "string" ? meta.reasoning_effort.trim().toLowerCase() : "";
  const displayText = typeof meta.display_text === "string" ? meta.display_text.trim() : "";
  const normalizedDisplayText = getChatModelDisplayText(model, reasoningEffort, displayText || model);

  if (!model && !normalizedDisplayText) return null;

  return {
    model: model || null,
    reasoning_effort: reasoningEffort || null,
    display_text: normalizedDisplayText || displayText || model,
  };
}

function mapHistoryRowToUiMessage(row, images = [], documents = []) {
  const isAssistant = row.role === "assistant";
  return {
    id: row.id || createId(),
    role: row.role,
    content: row.content,
    images: normalizeMessageImages(images),
    documents: normalizeMessageDocuments(documents),
    requestId: row.request_id,
    sources: isAssistant ? row.sources || [] : [],
    retrieval: isAssistant ? row.retrieval || null : null,
    assistantMeta: isAssistant ? normalizeAssistantMeta(row.assistant_meta) : null,
    usage: isAssistant
      ? {
          input_tokens: Number(row.input_tokens || 0),
          output_tokens: Number(row.output_tokens || 0),
        }
      : undefined,
    artifacts: isAssistant ? (Array.isArray(row.artifacts) ? row.artifacts : []) : undefined,
    toolResults: isAssistant ? (Array.isArray(row.tool_results) ? row.tool_results : []) : undefined,
    animate: false,
  };
}

function normalizeUser(user) {
  return {
    username: user?.username || "",
    role: user?.role || "user",
  };
}

function buildChatErrorMessage(message) {
  return {
    id: createId(),
    role: "assistant",
    content: `❌ ${message}`,
    animate: false,
  };
}

function waitForMs(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function waitForNextPaint() {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function WorkspaceEntryScreen() {
  return (
    <div className="workspaceLaunch" aria-live="polite">
      <div className="workspaceLaunchShell">
        <div className="workspaceLaunchBadge">Dominic Workspace</div>
        <h2 className="workspaceLaunchTitle">Đang tải đoạn chat của bạn</h2>
        <p className="workspaceLaunchText">
          Dominic đang khôi phục lịch sử hội thoại, đồng bộ tài liệu đã gắn và chuẩn bị không gian làm việc.
        </p>
        <div className="workspaceLaunchTimeline" aria-hidden="true">
          <div className="workspaceLaunchBubble workspaceLaunchBubbleUser">
            <span className="workspaceLaunchBubbleLine workspaceLaunchBubbleLineWide" />
            <span className="workspaceLaunchBubbleLine workspaceLaunchBubbleLineShort" />
          </div>
          <div className="workspaceLaunchBubble workspaceLaunchBubbleAssistant">
            <span className="workspaceLaunchBubbleLine workspaceLaunchBubbleLineMid" />
            <span className="workspaceLaunchBubbleLine workspaceLaunchBubbleLineWide" />
            <span className="workspaceLaunchBubbleLine workspaceLaunchBubbleLineTiny" />
          </div>
          <div className="workspaceLaunchBubble workspaceLaunchBubbleAssistant workspaceLaunchBubbleAssistantSecondary">
            <span className="workspaceLaunchBubbleLine workspaceLaunchBubbleLineMid" />
            <span className="workspaceLaunchBubbleLine workspaceLaunchBubbleLineShort" />
          </div>
        </div>
        <div className="workspaceLaunchProgress">
          <span className="workspaceLaunchProgressBar" />
        </div>
      </div>
    </div>
  );
}

function isAutoGeneratedSessionTitle(title) {
  return AUTO_SESSION_TITLE_PATTERN.test(typeof title === "string" ? title.trim() : "");
}

function mergeSessionsForUi(previousSessions, nextSessions, { animateGeneratedTitles = false } = {}) {
  const previousById = new Map((previousSessions || []).map((session) => [session.id, session]));

  return (nextSessions || []).map((session) => {
    const previousSession = previousById.get(session.id);
    const previousTitle = previousSession?.title || "";
    const nextTitle = session?.title || "";

    return {
      ...session,
      animateTitle: Boolean(
        animateGeneratedTitles &&
        previousSession &&
        previousTitle &&
        previousTitle !== nextTitle &&
        isAutoGeneratedSessionTitle(previousTitle) &&
        !isAutoGeneratedSessionTitle(nextTitle)
      ),
    };
  });
}

export default function App() {
  const imageCacheRef = useRef(new Map());
  const documentCacheRef = useRef(new Map());
  const activeSessionIdRef = useRef(null);
  const activeChatAbortRef = useRef(null);
  const streamingSessionIdRef = useRef(null);
  const [authUser, setAuthUser] = useState(null);
  const [activeView, setActiveView] = useState(VIEW_CHAT);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePagination, setMessagePagination] = useState(() => createEmptyMessagePagination());
  const [knowledgeDocuments, setKnowledgeDocuments] = useState([]);
  const [selectedKnowledgeDocumentId, setSelectedKnowledgeDocumentId] = useState(null);
  const [knowledgeChunks, setKnowledgeChunks] = useState([]);
  const [knowledgeJobs, setKnowledgeJobs] = useState([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState(EMPTY_KNOWLEDGE_SEARCH);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [adminCostMetrics, setAdminCostMetrics] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isPasswordBusy, setIsPasswordBusy] = useState(false);
  const [isEnteringWorkspace, setIsEnteringWorkspace] = useState(false);
  const [screenTransitionDirection, setScreenTransitionDirection] = useState("forward");
  const [loginError, setLoginError] = useState("");
  const [usage, setUsage] = useState(EMPTY_USAGE);
  const [theme, setTheme] = useState(getInitialTheme);
  const [activeDesign, setActiveDesign] = useState("modern");
  const [selectedChatModel, setSelectedChatModel] = useState(getInitialChatModel);
  const [thinkingEffortByModel, setThinkingEffortByModel] = useState(getInitialThinkingEffortByModel);
  const [chatModelCatalogState, setChatModelCatalogState] = useState(() => ({
    defaultModel: DEFAULT_CHAT_MODEL,
    supportedModels: SUPPORTED_CHAT_MODELS,
    availableModels: AVAILABLE_CHAT_MODELS,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAT_MODEL_STORAGE_KEY, selectedChatModel);
  }, [selectedChatModel]);

  useEffect(() => {
    if (!selectedChatModel || AVAILABLE_CHAT_MODELS.includes(selectedChatModel)) return;
    setSelectedChatModel(DEFAULT_CHAT_MODEL);
  }, [selectedChatModel, chatModelCatalogState]);

  useEffect(() => {
    if (!authUser?.username) return undefined;
    let cancelled = false;

    getChatModelCatalog()
      .then((catalog) => {
        if (cancelled) return;
        const nextCatalogState = configureChatModelCatalog(catalog);
        setChatModelCatalogState(nextCatalogState);
        setSelectedChatModel((current) => (
          nextCatalogState.availableModels.includes(current)
            ? current
            : nextCatalogState.defaultModel || nextCatalogState.availableModels[0] || ""
        ));
        setThinkingEffortByModel((current) => (
          Object.fromEntries(
            Object.entries(current)
              .filter(([modelName]) => nextCatalogState.availableModels.includes(modelName))
              .map(([modelName, effort]) => [modelName, normalizeThinkingEffortForModel(modelName, effort)])
              .filter(([, effort]) => Boolean(effort))
          )
        ));
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackCatalogState = configureChatModelCatalog();
        setChatModelCatalogState(fallbackCatalogState);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.username]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAT_MODEL_EFFORT_STORAGE_KEY, JSON.stringify(thinkingEffortByModel));
  }, [thinkingEffortByModel]);

  const resetAuthState = useCallback((nextError = "") => {
    activeChatAbortRef.current?.abort();
    activeChatAbortRef.current = null;
    streamingSessionIdRef.current = null;
    imageCacheRef.current.clear();
    documentCacheRef.current.clear();
    clearAuthSession();
    setScreenTransitionDirection("backward");
    setAuthUser(null);
    setActiveView(VIEW_CHAT);
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    setMessagePagination(createEmptyMessagePagination());
    setKnowledgeDocuments([]);
    setSelectedKnowledgeDocumentId(null);
    setKnowledgeChunks([]);
    setKnowledgeJobs([]);
    setKnowledgeSearch(EMPTY_KNOWLEDGE_SEARCH);
    setAdminUsers([]);
    setAdminAnalytics(null);
    setUsage(EMPTY_USAGE);
    setIsChatStreaming(false);
    setIsLoadingOlderMessages(false);
    setIsEnteringWorkspace(false);
    setLoginError(nextError);
  }, []);

  const isUnauthorizedError = useCallback((error) => error?.response?.status === 401, []);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    if (
      streamingSessionIdRef.current &&
      activeSessionId &&
      streamingSessionIdRef.current !== activeSessionId
    ) {
      activeChatAbortRef.current?.abort();
    }
  }, [activeSessionId]);

  useEffect(() => () => {
    activeChatAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    loadAndApplyDesign(`/DESIGN-${activeDesign}.md`).catch(err => {
      console.error("Failed to load design:", err);
    });
  }, [activeDesign]);

  const showChatLoadError = useCallback((error, fallback = "Không tải được lịch sử chat từ database.") => {
    setMessagePagination(createEmptyMessagePagination());
    setMessages([buildChatErrorMessage(extractErrorMessage(error, fallback))]);
  }, []);

  const getImageCacheKey = useCallback((sessionId, requestId) => {
    if (!sessionId || !requestId) return null;
    return `${sessionId}:${requestId}`;
  }, []);

  const storeCachedMessageImages = useCallback(
    (sessionId, requestId, images = []) => {
      const cacheKey = getImageCacheKey(sessionId, requestId);
      const normalizedImages = normalizeMessageImages(images);
      if (!cacheKey || normalizedImages.length === 0) return;
      imageCacheRef.current.set(cacheKey, normalizedImages);
    },
    [getImageCacheKey]
  );

  const storeCachedMessageDocuments = useCallback(
    (sessionId, requestId, documents = []) => {
      const cacheKey = getImageCacheKey(sessionId, requestId);
      const normalizedDocuments = normalizeMessageDocuments(documents);
      if (!cacheKey || normalizedDocuments.length === 0) return;
      documentCacheRef.current.set(cacheKey, normalizedDocuments);
    },
    [getImageCacheKey]
  );

  const moveCachedMessageImages = useCallback(
    (sessionId, sourceRequestId, targetRequestId) => {
      const sourceKey = getImageCacheKey(sessionId, sourceRequestId);
      const targetKey = getImageCacheKey(sessionId, targetRequestId);
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;

      const cachedImages = imageCacheRef.current.get(sourceKey);
      if (!cachedImages?.length) return;

      imageCacheRef.current.set(targetKey, cachedImages);
      imageCacheRef.current.delete(sourceKey);
    },
    [getImageCacheKey]
  );

  const moveCachedMessageDocuments = useCallback(
    (sessionId, sourceRequestId, targetRequestId) => {
      const sourceKey = getImageCacheKey(sessionId, sourceRequestId);
      const targetKey = getImageCacheKey(sessionId, targetRequestId);
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;

      const cachedDocuments = documentCacheRef.current.get(sourceKey);
      if (!cachedDocuments?.length) return;

      documentCacheRef.current.set(targetKey, cachedDocuments);
      documentCacheRef.current.delete(sourceKey);
    },
    [getImageCacheKey]
  );

  const resolveMessageImages = useCallback(
    (sessionId, row) => {
      const explicitImages = normalizeMessageImages(row?.images);
      if (explicitImages.length > 0) return explicitImages;

      const cacheKey = getImageCacheKey(sessionId, row?.request_id);
      return cacheKey ? imageCacheRef.current.get(cacheKey) || [] : [];
    },
    [getImageCacheKey]
  );

  const resolveMessageDocuments = useCallback(
    (sessionId, row) => {
      const explicitDocuments = normalizeMessageDocuments(row?.documents);
      if (explicitDocuments.length > 0) return explicitDocuments;

      const cacheKey = getImageCacheKey(sessionId, row?.request_id);
      return cacheKey ? documentCacheRef.current.get(cacheKey) || [] : [];
    },
    [getImageCacheKey]
  );

  const refreshUsage = useCallback(async () => {
    const data = await getUsage();
    setUsage(data);
  }, []);

  const loadSessions = useCallback(async (options = {}) => {
    const rows = await getSessions();
    let mergedRows = rows;
    setSessions((current) => {
      mergedRows = mergeSessionsForUi(current, rows, options);
      return mergedRows;
    });
    return mergedRows;
  }, []);

  const loadKnowledgeDocumentDetails = useCallback(async (documentId) => {
    if (!documentId) {
      setKnowledgeChunks([]);
      setKnowledgeJobs([]);
      return;
    }

    const [chunks, jobs] = await Promise.all([
      getKnowledgeChunks(documentId),
      getKnowledgeJobs(documentId),
    ]);
    setKnowledgeChunks(chunks);
    setKnowledgeJobs(jobs);
  }, []);

  const loadKnowledgeDocuments = useCallback(
    async (preferredDocumentId = null) => {
      const docs = await listKnowledgeDocuments();
      setKnowledgeDocuments(docs);

      const activeSessionDocs = activeSessionId
        ? docs.filter((doc) => doc.session_id === activeSessionId)
        : [];

      const candidateId =
        [preferredDocumentId, selectedKnowledgeDocumentId, activeSessionDocs[0]?.id, docs[0]?.id].find(
          (docId) => docId && docs.some((doc) => doc.id === docId)
        ) || null;

      if (!candidateId) {
        setSelectedKnowledgeDocumentId(null);
        setKnowledgeChunks([]);
        setKnowledgeJobs([]);
        return docs;
      }

      setSelectedKnowledgeDocumentId(candidateId);
      await loadKnowledgeDocumentDetails(candidateId);
      return docs;
    },
    [activeSessionId, loadKnowledgeDocumentDetails, selectedKnowledgeDocumentId]
  );

  const loadAdminUsers = useCallback(async () => {
    const rows = await listUsers();
    setAdminUsers(rows);
    return rows;
  }, []);

  const loadAdminAnalytics = useCallback(async () => {
    const analytics = await getKnowledgeAnalytics({ recent_limit: 20 });
    setAdminAnalytics(analytics);
    return analytics;
  }, []);

  const loadSessionMessages = useCallback(async (sessionId, options = {}) => {
    const {
      animateAssistantRequestId = null,
      applyIfActiveOnly = false,
      beforeId = null,
      limit = SESSION_MESSAGES_PAGE_SIZE,
      mode = beforeId ? "prepend" : "replace",
    } = options;
    const { items, pagination } = await getSessionMessages(sessionId, {
      limit,
      beforeId,
    });
    const nextMessages = items.map((row) => {
      const mappedRow = mapHistoryRowToUiMessage(
        row,
        resolveMessageImages(sessionId, row),
        resolveMessageDocuments(sessionId, row)
      );
      if (
        animateAssistantRequestId &&
        row.role === "assistant" &&
        row.request_id === animateAssistantRequestId
      ) {
        return { ...mappedRow, animate: true };
      }
      return mappedRow;
    });

    if (!applyIfActiveOnly || activeSessionIdRef.current === sessionId) {
      setMessages((current) => (mode === "prepend" ? [...nextMessages, ...current] : nextMessages));
      setMessagePagination({
        hasMore: Boolean(pagination?.hasMore),
        nextBeforeId: pagination?.nextBeforeId ?? null,
        limit: pagination?.limit ?? limit,
      });
    }

    return { items: nextMessages, pagination };
  }, [resolveMessageDocuments, resolveMessageImages]);

  const ensureSessionSelected = useCallback(
    async (preferredSessionId = null) => {
      const rows = await loadSessions();
      if (rows.length === 0) {
        const newSession = await createSession({ title: "Chat 1" });
        setSessions([{ ...newSession, animateTitle: false }]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        setMessagePagination(createEmptyMessagePagination());
        return [newSession];
      }

      const nextSessionId =
        [preferredSessionId, activeSessionId, rows[0]?.id].find(
          (sessionId) => sessionId && rows.some((session) => session.id === sessionId)
        ) || rows[0].id;

      if (nextSessionId) {
        setActiveSessionId(nextSessionId);
        await loadSessionMessages(nextSessionId);
        return rows;
      }

      return rows;
    },
    [activeSessionId, loadSessionMessages, loadSessions]
  );

  const hydrateAuthenticatedWorkspace = useCallback(
    async (userInput) => {
      const user = normalizeUser(userInput);
      setAuthUser(user);
      setActiveView(VIEW_CHAT);

      const tasks = [refreshUsage(), ensureSessionSelected(), loadKnowledgeDocuments()];
      if (user.role === "admin") {
        tasks.push(loadAdminUsers(), loadAdminAnalytics());
      } else {
        setAdminUsers([]);
        setAdminAnalytics(null);
      }

      const results = await Promise.allSettled(tasks);
      const historyTask = results[1];
      if (historyTask?.status === "rejected") {
        showChatLoadError(historyTask.reason);
      }
    },
    [ensureSessionSelected, loadAdminAnalytics, loadAdminUsers, loadKnowledgeDocuments, refreshUsage, showChatLoadError]
  );

  const runWorkspaceEntryTransition = useCallback(
    async (userInput) => {
      const startedAt = Date.now();
      setIsEnteringWorkspace(true);
      try {
        await hydrateAuthenticatedWorkspace(userInput);
      } finally {
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < WORKSPACE_ENTRY_MIN_MS) {
          await waitForMs(WORKSPACE_ENTRY_MIN_MS - elapsedMs);
        }
        setIsEnteringWorkspace(false);
      }
    },
    [hydrateAuthenticatedWorkspace]
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const existingToken = getStoredAuthToken();
      if (!existingToken) {
        if (isMounted) {
          setIsBootstrapping(false);
        }
        return;
      }

      setIsAuthLoading(true);
      try {
        const me = await getMe();
        if (isMounted) {
          await hydrateAuthenticatedWorkspace(me);
        }
      } catch {
        if (isMounted) {
          resetAuthState("");
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
          setIsBootstrapping(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [hydrateAuthenticatedWorkspace, resetAuthState]);

  const handleChangeView = useCallback(
    (nextView) => {
      if (nextView === VIEW_ADMIN && authUser?.role !== "admin") {
        setActiveView(VIEW_CHAT);
        return;
      }
      setActiveView(nextView);
    },
    [authUser]
  );

  const handleCreateSession = async () => {
    if (!authUser?.username || isChatStreaming) return;
    setIsChatLoading(true);
    try {
      const row = await createSession({
        title: `Chat ${sessions.length + 1}`,
      });
      await loadSessions();
      setActiveSessionId(row.id);
      setMessages([]);
      setMessagePagination(createEmptyMessagePagination());
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phien dang nhap da het han. Vui long dang nhap lai.");
      } else {
        showChatLoadError(error, "Không tạo được chat session mới.");
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSelectSession = async (sessionId) => {
    if (!authUser?.username || isChatStreaming) return;
    setIsChatLoading(true);
    try {
      setActiveSessionId(sessionId);
      await loadSessionMessages(sessionId);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phien dang nhap da het han. Vui long dang nhap lai.");
      } else {
        showChatLoadError(error);
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleLogin = async ({ username, password }) => {
    setIsAuthLoading(true);
    setLoginError("");
    setScreenTransitionDirection("forward");
    try {
      const data = await login({ username, password });
      setAuthSession(data);
      await runWorkspaceEntryTransition(data);
    } catch (error) {
      clearAuthSession();
      setIsEnteringWorkspace(false);
      setLoginError(extractErrorMessage(error, "Dang nhap that bai."));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegister = async ({ username, password, confirmPassword }) => {
    setIsAuthLoading(true);
    setLoginError("");
    setScreenTransitionDirection("forward");
    try {
      const data = await register({
        username,
        password,
        confirm_password: confirmPassword,
      });
      setAuthSession(data);
      await runWorkspaceEntryTransition(data);
    } catch (error) {
      clearAuthSession();
      setIsEnteringWorkspace(false);
      setLoginError(extractErrorMessage(error, "Dang ky that bai."));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResetPassword = async (payload) => {
    setIsAuthLoading(true);
    setLoginError("");
    try {
      const data = await resetPassword(payload);
      return {
        success: true,
        message: data.message || "Đặt lại mật khẩu thành công.",
      };
    } catch (error) {
      return {
        success: false,
        message: extractErrorMessage(error, "Dat lai mat khau that bai."),
      };
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleChangePassword = async (payload) => {
    setIsPasswordBusy(true);
    try {
      const data = await changePassword(payload);
      resetAuthState(data.message || "Mật khẩu đã được đổi. Vui lòng đăng nhập lại.");
      return {
        success: true,
        message: data.message || "Đổi mật khẩu thành công.",
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phien dang nhap da het han. Vui long dang nhap lai.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Doi mat khau that bai."),
      };
    } finally {
      setIsPasswordBusy(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (isChatStreaming) return;
    try {
      await deleteSession(sessionId);
      for (const key of imageCacheRef.current.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
          imageCacheRef.current.delete(key);
          documentCacheRef.current.delete(key);
        }
      }
      const rows = await loadSessions();
      if (activeSessionId === sessionId) {
        if (rows.length > 0) {
          setActiveSessionId(rows[0].id);
          await loadSessionMessages(rows[0].id);
        } else {
          const newSession = await createSession({ title: "Chat 1" });
          setSessions([{ ...newSession, animateTitle: false }]);
          setActiveSessionId(newSession.id);
          setMessages([]);
          setMessagePagination(createEmptyMessagePagination());
        }
      }
    } catch (error) {
      if (isUnauthorizedError(error)) resetAuthState("Phiên đăng nhập đã hết hạn.");
    }
  };

  const handleLogout = async () => {
    try {
      // First attempt — may get 401 when the access token has already expired.
      try {
        await logout();
      } catch (firstError) {
        // Only attempt a single refresh + retry when the initial call returned
        // 401 AND a refresh token is still available.  Logout is kept as an
        // explicit, self-contained flow and never enters the generic interceptor.
        if (firstError?.response?.status === 401 && getStoredRefreshToken()) {
          try {
            await refreshAuthSession(); // rotates tokens; throws on invalid refresh
            await logout();             // retry exactly once with the new access token
          } catch {
            // Refresh or logout-retry failed — the finally block below
            // guarantees local state is cleared regardless.
          }
        }
        // Non-401 first-attempt errors are also swallowed for the same reason.
      }
    } finally {
      // Always clear local auth state, whether the server call
      // succeeded, was retried, or failed entirely.
      resetAuthState("");
    }
  };

  const handleThinkingEffortChange = useCallback((modelName, effort) => {
    if (!AVAILABLE_CHAT_MODELS.includes(modelName)) return;
    const normalized = normalizeThinkingEffortForModel(modelName, effort);
    if (!normalized) return;

    setThinkingEffortByModel((current) => ({
      ...current,
      [modelName]: normalized,
    }));
  }, []);

  const handleSendMessage = async (text, images = [], options = {}) => {
    if (!authUser?.username || !activeSessionId || isChatStreaming) return;

    const targetSessionId = activeSessionId;
    const sessionScopedDocuments = normalizeMessageDocuments(
      knowledgeDocuments
        .filter((document) => document.session_id === targetSessionId)
        .map((document) => ({
          id: document.id,
          title: document.title,
          session_id: document.session_id,
        }))
    );
    const hasSessionScopedDocuments = sessionScopedDocuments.length > 0;
    const selectedKnowledgeDocument =
      knowledgeDocuments.find((document) => document.id === selectedKnowledgeDocumentId) || null;
    const canUseSelectedKnowledgeDocument =
      selectedKnowledgeDocument &&
      (selectedKnowledgeDocument.session_id == null ||
        selectedKnowledgeDocument.session_id === targetSessionId) &&
      (!hasSessionScopedDocuments || selectedKnowledgeDocument.session_id === targetSessionId);
    const effectiveKnowledgeDocumentId = canUseSelectedKnowledgeDocument
      ? selectedKnowledgeDocument.id
      : undefined;

    const normalizedImages = normalizeMessageImages(images);
    const optimisticMessageId = createId();
    const assistantMessageId = createId();
    const optimisticRequestId =
      normalizedImages.length > 0 || sessionScopedDocuments.length > 0
        ? `pending:${optimisticMessageId}`
        : undefined;

    if (optimisticRequestId) {
      storeCachedMessageImages(targetSessionId, optimisticRequestId, normalizedImages);
      storeCachedMessageDocuments(targetSessionId, optimisticRequestId, sessionScopedDocuments);
    }

    const userMessage = {
      id: optimisticMessageId,
      role: "user",
      content: text,
      images: normalizedImages,
      documents: sessionScopedDocuments,
      requestId: optimisticRequestId,
      animate: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);
    setIsChatStreaming(true);

    try {
      const effectiveModel = options.model || selectedChatModel;
      const requestedThinkingEffort = normalizeThinkingEffortForModel(
        effectiveModel,
        options.reasoningEffort || thinkingEffortByModel[effectiveModel]
      );
      const reasoningEffort = supportsThinkingEffort(effectiveModel)
        ? requestedThinkingEffort || getDefaultThinkingEffortForModel(effectiveModel)
        : undefined;
      const placeholderAssistantMeta = normalizeAssistantMeta({
        model: effectiveModel,
        reasoning_effort: reasoningEffort,
        display_text: getChatModelDisplayText(effectiveModel, reasoningEffort, effectiveModel),
      });
      let streamedReply = "";
      let assistantMessageInserted = false;
      const streamController = new AbortController();

      activeChatAbortRef.current = streamController;
      streamingSessionIdRef.current = targetSessionId;

      const syncResolvedRequestId = (resolvedRequestId) => {
        if (!resolvedRequestId) return;
        if (optimisticRequestId) {
          moveCachedMessageImages(targetSessionId, optimisticRequestId, resolvedRequestId);
          moveCachedMessageDocuments(targetSessionId, optimisticRequestId, resolvedRequestId);
        }
        setMessages((prev) => prev.map((message) => {
          if (message.id === optimisticMessageId) {
            return {
              ...message,
              requestId: resolvedRequestId,
              images: normalizedImages,
              documents: sessionScopedDocuments,
            };
          }
          if (message.id === assistantMessageId) {
            return {
              ...message,
              requestId: resolvedRequestId,
            };
          }
          return message;
        }));
      };

      const ensureAssistantMessage = (initialContent = "") => {
        if (assistantMessageInserted) return;
        assistantMessageInserted = true;
        setIsChatLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: initialContent,
            sources: [],
            retrieval: null,
            assistantMeta: placeholderAssistantMeta,
            artifacts: [],
            toolResults: [],
            animate: false,
          },
        ]);
      };

      const upsertStreamingArtifact = (artifact) => {
        if (!artifact || typeof artifact !== "object") return;
        ensureAssistantMessage("");
        setMessages((prev) => prev.map((message) => {
          if (message.id !== assistantMessageId) return message;
          const existingArtifacts = Array.isArray(message.artifacts) ? message.artifacts : [];
          const artifactKey = artifact.id || `${artifact.type}-${artifact.title}`;
          const nextArtifacts = existingArtifacts.some((item) => (item.id || `${item.type}-${item.title}`) === artifactKey)
            ? existingArtifacts.map((item) => (
                (item.id || `${item.type}-${item.title}`) === artifactKey ? artifact : item
              ))
            : [...existingArtifacts, artifact];
          return {
            ...message,
            requestId: artifact?.metadata?.request_id || message.requestId,
            artifacts: nextArtifacts,
            animate: false,
          };
        }));
      };

      await sendChatMessageStream({
        session_id: targetSessionId,
        message: text,
        knowledge_document_id: effectiveKnowledgeDocumentId,
        use_web_search: Boolean(options.useWebSearch),
        model: effectiveModel,
        reasoning_effort: reasoningEffort,
        images: images.length > 0 ? images : undefined,
      }, {
        signal: streamController.signal,
        onEvent: async ({ event, data }) => {
          if (event === "start") {
            syncResolvedRequestId(data?.request_id);
            return;
          }

          if (event === "delta") {
            const deltaText = typeof data?.text === "string" ? data.text : "";
            if (!deltaText) return;

            streamedReply += deltaText;
            ensureAssistantMessage(streamedReply);
            setMessages((prev) => prev.map((message) => (
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: streamedReply,
                    requestId: data?.request_id || message.requestId,
                  }
                : message
            )));
            await waitForNextPaint();
            return;
          }

          if (event === "artifact_start" || event === "artifact_delta" || event === "artifact_done" || event === "artifact_error") {
            upsertStreamingArtifact(buildExcalidrawArtifactFromStreamEvent(event, data));
            await waitForNextPaint();
            return;
          }

          if (event === "final") {
            const finalReply = typeof data?.reply === "string" ? data.reply : streamedReply;
            syncResolvedRequestId(data?.request_id);
            ensureAssistantMessage(finalReply);
            setMessages((prev) => prev.map((message) => (
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: finalReply,
                    requestId: data?.request_id || message.requestId,
                    sources: Array.isArray(data?.sources) ? data.sources : [],
                    retrieval: data?.retrieval || null,
                    assistantMeta: normalizeAssistantMeta(data?.assistant_meta) || placeholderAssistantMeta,
                    usage: data?.usage || message.usage,
                    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
                    toolResults: Array.isArray(data?.tool_results) ? data.tool_results : [],
                    animate: false,
                  }
                : message
            )));
            setIsChatLoading(false);
          }
        },
      });
      await Promise.all([refreshUsage(), loadSessions({ animateGeneratedTitles: true })]);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      if (isUnauthorizedError(error)) {
        resetAuthState("Phien dang nhap da het han. Vui long dang nhap lai.");
        return;
      }

      const errorMessage = {
        id: createId(),
        role: "assistant",
        content: `❌ ${extractErrorMessage(error, "Co loi khi goi API chat.")}`,
        animate: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
      try {
        await refreshUsage();
      } catch {
        // Ignore usage refresh failure to avoid masking original chat error.
      }
    } finally {
      setIsChatLoading(false);
      setIsChatStreaming(false);
      if (activeChatAbortRef.current?.signal?.aborted || streamingSessionIdRef.current === targetSessionId) {
        activeChatAbortRef.current = null;
        streamingSessionIdRef.current = null;
      }
    }
  };

  const handleLoadOlderMessages = async () => {
    if (
      !authUser?.username ||
      !activeSessionId ||
      isChatStreaming ||
      isLoadingOlderMessages ||
      !messagePagination.hasMore ||
      !messagePagination.nextBeforeId
    ) {
      return;
    }

    setIsLoadingOlderMessages(true);
    try {
      await loadSessionMessages(activeSessionId, {
        beforeId: messagePagination.nextBeforeId,
        limit: messagePagination.limit || SESSION_MESSAGES_PAGE_SIZE,
        mode: "prepend",
        applyIfActiveOnly: true,
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phien dang nhap da het han. Vui long dang nhap lai.");
      }
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

  const handleSelectKnowledgeDocument = async (docId) => {
    setIsKnowledgeLoading(true);
    try {
      setSelectedKnowledgeDocumentId(docId);
      await loadKnowledgeDocumentDetails(docId);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const handleSearchKnowledge = async ({ query, topK }) => {
    setIsKnowledgeLoading(true);
    try {
      // Panel search is owner-wide: do NOT send document_id, session_id, or scope.
      const data = await searchKnowledge({
        query,
        top_k: topK,
      });
      setKnowledgeSearch(data);
      return {
        success: true,
        message: `Search hoàn tất. Tìm thấy ${data.returned} chunks phù hợp.`,
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Search knowledge thất bại."),
      };
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const handleRefreshKnowledgeDocuments = async () => {
    setIsKnowledgeLoading(true);
    try {
      await loadKnowledgeDocuments();
      return { success: true, message: "Đã làm mới knowledge base." };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Lam moi knowledge base that bai."),
      };
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const handleUploadKnowledgeFile = async (file, sessionId = null) => {
    setIsKnowledgeLoading(true);
    try {
      const data = await uploadKnowledgeFile(file, { sessionId });
      await loadKnowledgeDocuments(data.document_id);
      return {
        success: true,
        message: `Upload thành công. Document #${data.document_id} đã tạo ${data.chunks_count} chunks.`,
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Upload tài liệu thất bại."),
      };
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const handleIngestKnowledgeText = async (payload, sessionId = null) => {
    setIsKnowledgeLoading(true);
    try {
      const data = await ingestKnowledgeText({ ...payload, session_id: sessionId });
      await loadKnowledgeDocuments(data.document_id);
      return {
        success: true,
        message: `Ingest thành công. Document #${data.document_id} đã tạo ${data.chunks_count} chunks.`,
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Ingest text thất bại."),
      };
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const handleReindexKnowledgeDocument = async (docId) => {
    setIsKnowledgeLoading(true);
    try {
      const data = await reindexKnowledgeDocument(docId);
      await loadKnowledgeDocuments(docId);
      return {
        success: true,
        message: `Reindex thành công. ${data.chunks_count} chunks đang được đồng bộ lại.`,
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Reindex tài liệu thất bại."),
      };
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const handleDeleteKnowledgeDocument = async (docId) => {
    setIsKnowledgeLoading(true);
    try {
      await deleteKnowledgeDocument(docId);
      await loadKnowledgeDocuments();
      setKnowledgeSearch(EMPTY_KNOWLEDGE_SEARCH);
      return {
        success: true,
        message: `Đã xóa document #${docId}.`,
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Xóa tài liệu thất bại."),
      };
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const handleRefreshAdminUsers = useCallback(async () => {
    if (authUser?.role !== "admin") {
      return { success: false, message: "Bạn không có quyền admin." };
    }

    setIsAdminLoading(true);
    try {
      await loadAdminUsers();
      await loadAdminAnalytics();
      return { success: true, message: "Đã tải danh sách users và analytics." };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Lay danh sach users that bai."),
      };
    } finally {
      setIsAdminLoading(false);
    }
  }, [authUser?.role, isUnauthorizedError, loadAdminAnalytics, loadAdminUsers, resetAuthState]);

  const handleSetAdminUserRole = async (username, role) => {
    setIsAdminLoading(true);
    try {
      const data = await setUserRole({ username, role });
      await loadAdminUsers();

      if (authUser?.username === username) {
        setAuthUser((prev) => (prev ? { ...prev, role } : prev));
        if (role !== "admin" && activeView === VIEW_ADMIN) {
          setActiveView(VIEW_CHAT);
        }
      }

      return {
        success: true,
        message: data.message || `Đã cập nhật role ${role} cho ${username}.`,
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Cap nhat role that bai."),
      };
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleGenerateResetToken = async (username, expireMinutes) => {
    setIsAdminLoading(true);
    try {
      const data = await adminResetPassword({
        username,
        expire_minutes: expireMinutes,
      });
      return {
        success: true,
        message: `Đã tạo reset token cho ${username}.`,
        reset_token: data.reset_token,
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        resetAuthState("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      return {
        success: false,
        message: extractErrorMessage(error, "Tao reset token that bai."),
      };
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleLoadAuditLogs = async (filters = {}) => {
    setIsAdminLoading(true);
    try {
      const data = await getAuditLogs(filters);
      setAdminAuditLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      if (isUnauthorizedError(error)) resetAuthState("Phiên đăng nhập đã hết hạn.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleLoadCostMetrics = async () => {
    setIsAdminLoading(true);
    try {
      const data = await getCostMetrics();
      setAdminCostMetrics(data);
    } catch (error) {
      if (isUnauthorizedError(error)) resetAuthState("Phiên đăng nhập đã hết hạn.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  useEffect(() => {
    if (
      activeView === VIEW_ADMIN &&
      authUser?.role === "admin" &&
      adminUsers.length === 0 &&
      !isAdminLoading
    ) {
      handleRefreshAdminUsers();
    }
  }, [activeView, adminUsers.length, authUser?.role, handleRefreshAdminUsers, isAdminLoading]);

  let screenKey = "login";
  let screenClassName = "screenTransitionLayer";
  let screenContent = (
    <Suspense fallback={<LazyViewFallback message="Đang tải màn hình đăng nhập..." />}>
      <Login
        onLogin={handleLogin}
        onRegister={handleRegister}
        onResetPassword={handleResetPassword}
        isLoading={isAuthLoading || isBootstrapping}
        isBootstrapping={isBootstrapping}
        error={loginError}
      />
    </Suspense>
  );

  if (authUser && isEnteringWorkspace) {
    screenKey = "entry";
    screenContent = <WorkspaceEntryScreen />;
  } else if (authUser) {
    const currentSessionDocuments = activeSessionId
      ? knowledgeDocuments.filter((document) => document.session_id === activeSessionId)
      : [];
    const selectedKnowledgeDocument =
      knowledgeDocuments.find((document) => document.id === selectedKnowledgeDocumentId) || null;
    const visibleScopedDocuments = currentSessionDocuments.length > 0
      ? currentSessionDocuments
      : selectedKnowledgeDocument &&
        (selectedKnowledgeDocument.session_id == null ||
          selectedKnowledgeDocument.session_id === activeSessionId)
        ? [selectedKnowledgeDocument]
        : [];
    const activeSession = sessions.find((session) => session.id === activeSessionId) || null;

    let mainContent;

    if (activeView === VIEW_KNOWLEDGE) {
      mainContent = (
        <div className="workspaceView">
          <Suspense fallback={<LazyViewFallback message="Đang tải kho tri thức..." />}>
            <KnowledgePanel
              documents={knowledgeDocuments}
              selectedDocumentId={selectedKnowledgeDocumentId}
              chunks={knowledgeChunks}
              jobs={knowledgeJobs}
              searchState={knowledgeSearch}
              isLoading={isKnowledgeLoading}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectDocument={handleSelectKnowledgeDocument}
              onRefreshDocuments={handleRefreshKnowledgeDocuments}
              onUploadFile={handleUploadKnowledgeFile}
              onIngestText={handleIngestKnowledgeText}
              onSearchKnowledge={handleSearchKnowledge}
              onReindexDocument={handleReindexKnowledgeDocument}
              onDeleteDocument={handleDeleteKnowledgeDocument}
            />
          </Suspense>
        </div>
      );
    } else if (activeView === VIEW_ADMIN && authUser.role === "admin") {
      mainContent = (
        <div className="workspaceView">
          <Suspense fallback={<LazyViewFallback message="Đang tải bảng quản trị..." />}>
            <AdminPanel
              users={adminUsers}
              analytics={adminAnalytics}
              auditLogs={adminAuditLogs}
              costMetrics={adminCostMetrics}
              currentUsername={authUser.username}
              isLoading={isAdminLoading}
              onRefreshUsers={handleRefreshAdminUsers}
              onSetUserRole={handleSetAdminUserRole}
              onGenerateResetToken={handleGenerateResetToken}
              onLoadAuditLogs={handleLoadAuditLogs}
              onLoadCostMetrics={handleLoadCostMetrics}
            />
          </Suspense>
        </div>
      );
    } else {
      mainContent = (
        <div className="chatView">
          <Suspense fallback={<LazyViewFallback message="Đang tải giao diện chat..." />}>
            <ChatWindow
              messages={messages}
              isLoading={isChatLoading}
              scopedDocuments={visibleScopedDocuments}
              sessionTitle={activeSession?.title || ""}
              hasMoreHistory={messagePagination.hasMore}
              isLoadingOlder={isLoadingOlderMessages}
              onLoadOlder={handleLoadOlderMessages}
            />
            <ChatInput
              disabled={!authUser?.username || isChatLoading || isChatStreaming}
              onSendMessage={handleSendMessage}
              onUploadKnowledgeFile={(file) => handleUploadKnowledgeFile(file, activeSessionId)}
              onIngestKnowledgeText={(payload) => handleIngestKnowledgeText(payload, activeSessionId)}
              isKnowledgeLoading={isKnowledgeLoading}
              sessionDocuments={currentSessionDocuments}
              selectedModel={selectedChatModel}
              availableModels={chatModelCatalogState.supportedModels}
              onModelChange={setSelectedChatModel}
              thinkingEffortByModel={thinkingEffortByModel}
              onThinkingEffortChange={handleThinkingEffortChange}
            />
          </Suspense>
        </div>
      );
    }

    screenKey = "workspace";
    screenClassName = "workspaceStage";
    screenContent = (
      <>
        <AppLayout
          user={authUser}
          activeView={activeView}
          onChangeView={handleChangeView}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onCreateSession={handleCreateSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onLogout={handleLogout}
          onChangePassword={handleChangePassword}
          theme={theme}
          onThemeChange={setTheme}
          isPasswordBusy={isPasswordBusy}
          totalTokenUsed={usage.total_token_used}
          maxTokensPerDay={usage.max_tokens_per_day}
        >
          {mainContent}
        </AppLayout>

        {authUser && (
          <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 9999, background: "var(--panel)", padding: "10px", borderRadius: "8px", border: "1px solid var(--shell-border)", boxShadow: "var(--shell-shadow)", display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: "bold" }}>UI Design:</span>
            <select 
              value={activeDesign} 
              onChange={(e) => setActiveDesign(e.target.value)}
              style={{ padding: "4px 8px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--shell-border)", borderRadius: "4px", fontSize: "12px", outline: "none" }}
            >
              <option value="modern">Modern (Stitch)</option>
              <option value="legacy">Legacy (Dominic)</option>
            </select>
            <input 
              type="file" 
              accept=".md" 
              style={{ display: "none" }} 
              id="design-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    import('./utils/themeParser').then(({ loadAndApplyDesign }) => {
                      loadAndApplyDesign(ev.target.result, false).catch(console.error);
                    });
                  };
                  reader.readAsText(file);
                }
              }}
            />
            <button 
              onClick={() => document.getElementById('design-upload').click()} 
              style={{ padding: "4px 8px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "bold" }}
            >
              Upload .md
            </button>
          </div>
        )}
      </>
    );
  }

  const screenStageVariants = getScreenStageVariants(screenKey, screenTransitionDirection);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Motion.div
        key={screenKey}
        className={screenClassName}
        initial={screenStageVariants.initial}
        animate={screenStageVariants.animate}
        exit={screenStageVariants.exit}
        transition={SCREEN_STAGE_TRANSITION}
      >
        {screenContent}
      </Motion.div>
    </AnimatePresence>
  );
}
