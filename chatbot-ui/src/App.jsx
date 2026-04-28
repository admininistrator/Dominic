import { useCallback, useEffect, useRef, useState } from "react";
import AppLayout from "./components/App/App";
import AdminPanel from "./components/AdminPanel/AdminPanel";
import ChatInput from "./components/ChatInput/ChatInput";
import ChatWindow from "./components/ChatWindow/ChatWindow";
import KnowledgePanel from "./components/KnowledgePanel/KnowledgePanel";
import Login from "./components/Login/Login";
import "./App.css";
import {
  adminResetPassword,
  changePassword,
  getMe,
  listUsers,
  login,
  register,
  resetPassword,
  setUserRole,
} from "./service/authApi";
import {
  createSession,
  deleteSession,
  renameSession,
  getSessionMessages,
  getSessions,
  getUsage,
  sendChatMessage,
} from "./service/chatApi";
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
import { clearAuthToken, getStoredAuthToken, setAuthToken } from "./service/apiClient";
import "./styles/globals.css";

const VIEW_CHAT = "chat";
const VIEW_KNOWLEDGE = "knowledge";
const VIEW_ADMIN = "admin";
const THEME_STORAGE_KEY = "dominic-ui-theme";

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
    usage: isAssistant
      ? {
          input_tokens: Number(row.input_tokens || 0),
          output_tokens: Number(row.output_tokens || 0),
        }
      : undefined,
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

export default function App() {
  const imageCacheRef = useRef(new Map());
  const documentCacheRef = useRef(new Map());
  const activeSessionIdRef = useRef(null);
  const [authUser, setAuthUser] = useState(null);
  const [activeView, setActiveView] = useState(VIEW_CHAT);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
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
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isPasswordBusy, setIsPasswordBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [usage, setUsage] = useState(EMPTY_USAGE);
  const [theme, setTheme] = useState(getInitialTheme);

  const resetAuthState = useCallback((nextError = "") => {
    imageCacheRef.current.clear();
    documentCacheRef.current.clear();
    clearAuthToken();
    setAuthUser(null);
    setActiveView(VIEW_CHAT);
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    setKnowledgeDocuments([]);
    setSelectedKnowledgeDocumentId(null);
    setKnowledgeChunks([]);
    setKnowledgeJobs([]);
    setKnowledgeSearch(EMPTY_KNOWLEDGE_SEARCH);
    setAdminUsers([]);
    setAdminAnalytics(null);
    setUsage(EMPTY_USAGE);
    setLoginError(nextError);
  }, []);

  const isUnauthorizedError = useCallback((error) => error?.response?.status === 401, []);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const showChatLoadError = useCallback((error, fallback = "Không tải được lịch sử chat từ database.") => {
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

  const loadSessions = useCallback(async () => {
    const rows = await getSessions();
    setSessions(rows);
    return rows;
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
    const { animateAssistantRequestId = null, applyIfActiveOnly = false } = options;
    const rows = await getSessionMessages(sessionId);
    const nextMessages = rows.map((row) => {
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
      setMessages(nextMessages);
    }

    return nextMessages;
  }, [resolveMessageDocuments, resolveMessageImages]);

  const ensureSessionSelected = useCallback(
    async (preferredSessionId = null) => {
      const rows = await loadSessions();
      if (rows.length === 0) {
        const newSession = await createSession({ title: "Chat 1" });
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([]);
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
    if (!authUser?.username) return;
    setIsChatLoading(true);
    try {
      const row = await createSession({
        title: `Chat ${sessions.length + 1}`,
      });
      await loadSessions();
      setActiveSessionId(row.id);
      setMessages([]);
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
    if (!authUser?.username) return;
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
    try {
      const data = await login({ username, password });
      setAuthToken(data.access_token);
      await hydrateAuthenticatedWorkspace(data);
    } catch (error) {
      clearAuthToken();
      setLoginError(extractErrorMessage(error, "Dang nhap that bai."));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegister = async ({ username, password, confirmPassword }) => {
    setIsAuthLoading(true);
    setLoginError("");
    try {
      const data = await register({
        username,
        password,
        confirm_password: confirmPassword,
      });
      setAuthToken(data.access_token);
      await hydrateAuthenticatedWorkspace(data);
    } catch (error) {
      clearAuthToken();
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
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
          setMessages([]);
        }
      }
    } catch (error) {
      if (isUnauthorizedError(error)) resetAuthState("Phiên đăng nhập đã hết hạn.");
    }
  };

  const handleRenameSession = async (sessionId, title) => {
    try {
      await renameSession(sessionId, title);
      await loadSessions();
    } catch (error) {
      if (isUnauthorizedError(error)) resetAuthState("Phiên đăng nhập đã hết hạn.");
    }
  };

  const handleLogout = () => {
    resetAuthState("");
  };

  const handleSendMessage = async (text, images = [], options = {}) => {
    if (!authUser?.username || !activeSessionId) return;

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

    try {
      const data = await sendChatMessage({
        session_id: targetSessionId,
        message: text,
        knowledge_document_id: effectiveKnowledgeDocumentId,
        use_web_search: Boolean(options.useWebSearch),
        images: images.length > 0 ? images : undefined,
      });

      if (optimisticRequestId && data.request_id) {
        moveCachedMessageImages(targetSessionId, optimisticRequestId, data.request_id);
        moveCachedMessageDocuments(targetSessionId, optimisticRequestId, data.request_id);
        setMessages((prev) => prev.map((message) => (
          message.id === optimisticMessageId
            ? {
                ...message,
                requestId: data.request_id,
                images: normalizedImages,
                documents: sessionScopedDocuments,
              }
            : message
        )));
      }

      await loadSessionMessages(targetSessionId, {
        animateAssistantRequestId: data.request_id,
        applyIfActiveOnly: true,
      });
      await Promise.all([refreshUsage(), loadSessions()]);
    } catch (error) {
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

  const handleSearchKnowledge = async ({ query, topK, documentId }) => {
    setIsKnowledgeLoading(true);
    try {
      const data = await searchKnowledge({
        query,
        top_k: topK,
        document_id: documentId,
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

  if (!authUser) {
    return (
      <Login
        onLogin={handleLogin}
        onRegister={handleRegister}
        onResetPassword={handleResetPassword}
        isLoading={isAuthLoading || isBootstrapping}
        isBootstrapping={isBootstrapping}
        error={loginError}
      />
    );
  }

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

  let mainContent;

  if (activeView === VIEW_KNOWLEDGE) {
    mainContent = (
      <div className="workspaceView">
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
      </div>
    );
  } else if (activeView === VIEW_ADMIN && authUser.role === "admin") {
    mainContent = (
      <div className="workspaceView">
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
      </div>
    );
  } else {
    mainContent = (
      <div className="chatView">
        <ChatWindow
          messages={messages}
          isLoading={isChatLoading}
          scopedDocuments={visibleScopedDocuments}
        />
        <ChatInput 
          disabled={!authUser?.username || isChatLoading} 
          onSendMessage={handleSendMessage}
          onUploadKnowledgeFile={(file) => handleUploadKnowledgeFile(file, activeSessionId)}
          onIngestKnowledgeText={(payload) => handleIngestKnowledgeText(payload, activeSessionId)}
          isKnowledgeLoading={isKnowledgeLoading}
          sessionDocuments={currentSessionDocuments}
        />
      </div>
    );
  }

  return (
    <AppLayout
      user={authUser}
      activeView={activeView}
      onChangeView={handleChangeView}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onCreateSession={handleCreateSession}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
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
  );
}
