import { useCallback, useState } from "react";
import AppLayout from "./components/App/App";
import Login from "./components/Login/Login";
import {
  createSession,
  getSessionMessages,
  getSessions,
  getUsage,
  login,
  sendChatMessage,
} from "./service/chatApi";
import "./styles/globals.css";

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapHistoryRowToUiMessage(row) {
  const isAssistant = row.role === "assistant";
  return {
    id: row.id || createId(),
    role: row.role,
    content: row.content,
    usage: isAssistant
      ? {
          input_tokens: Number(row.input_tokens || 0),
          output_tokens: Number(row.output_tokens || 0),
        }
      : undefined,
    animate: false,
  };
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [usage, setUsage] = useState({
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
  });

  const refreshUsage = useCallback(async (username) => {
    const data = await getUsage(username);
    setUsage(data);
  }, []);

  const loadSessions = useCallback(async (username) => {
    const rows = await getSessions(username);
    setSessions(rows);
    return rows;
  }, []);

  const loadSessionMessages = useCallback(async (username, sessionId) => {
    const rows = await getSessionMessages(username, sessionId);
    setMessages(rows.map(mapHistoryRowToUiMessage));
  }, []);

  const handleCreateSession = async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      const row = await createSession({
        username: authUser,
        title: `Chat ${sessions.length + 1}`,
      });
      const updated = await loadSessions(authUser);
      setActiveSessionId(row.id);
      setMessages([]);
      if (!updated.find((s) => s.id === row.id)) {
        setSessions((prev) => [row, ...prev]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = async (sessionId) => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      setActiveSessionId(sessionId);
      await loadSessionMessages(authUser, sessionId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async ({ username, password }) => {
    setIsLoading(true);
    setLoginError("");
    try {
      const data = await login({ username, password });
      setAuthUser(data.username);
      await refreshUsage(data.username);

      const rows = await loadSessions(data.username);
      if (rows.length > 0) {
        setActiveSessionId(rows[0].id);
        await loadSessionMessages(data.username, rows[0].id);
      } else {
        const newSession = await createSession({ username: data.username, title: "Chat 1" });
        setActiveSessionId(newSession.id);
        setMessages([]);
        await loadSessions(data.username);
      }
    } catch (error) {
      const detail = error?.response?.data?.detail || "Dang nhap that bai.";
      setLoginError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    setUsage({
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
    });
    setLoginError("");
  };

  const handleSendMessage = async (text) => {
    if (!authUser?.trim() || !activeSessionId) return;

    const userMessage = {
      id: createId(),
      role: "user",
      content: text,
      animate: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const data = await sendChatMessage({
        username: authUser,
        session_id: activeSessionId,
        message: text,
      });

      const assistantMessage = {
        id: createId(),
        role: "assistant",
        content: data.reply,
        usage: data.usage,
        animate: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await refreshUsage(authUser);
      await loadSessions(authUser);
    } catch (error) {
      const detail = error?.response?.data?.detail || "Co loi khi goi API chat.";
      const errorMessage = {
        id: createId(),
        role: "assistant",
        content: `❌ ${detail}`,
        animate: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
      await refreshUsage(authUser);
    } finally {
      setIsLoading(false);
    }
  };

  if (!authUser) {
    return <Login onLogin={handleLogin} isLoading={isLoading} error={loginError} />;
  }

  return (
    <AppLayout
      username={authUser}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onCreateSession={handleCreateSession}
      onSelectSession={handleSelectSession}
      onLogout={handleLogout}
      messages={messages}
      isLoading={isLoading}
      onSendMessage={handleSendMessage}
      totalTokenUsed={usage.total_token_used}
      inputTokenUsed={usage.total_input_tokens_used}
      outputTokenUsed={usage.total_output_tokens_used}
      lifetimeTotalTokenUsed={usage.lifetime_total_token_used}
      lifetimeInputTokenUsed={usage.lifetime_total_input_tokens_used}
      lifetimeOutputTokenUsed={usage.lifetime_total_output_tokens_used}
      rollingWindowHours={usage.rolling_window_hours}
      maxTokensPerDay={usage.max_tokens_per_day}
    />
  );
}
