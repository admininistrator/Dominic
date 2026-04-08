import { useCallback, useState } from "react";
import AppLayout from "./components/App/App";
import Login from "./components/Login/Login";
import { getUsage, login, sendChatMessage } from "./service/chatApi";
import "./styles/globals.css";

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [usage, setUsage] = useState({
    username: "",
    max_tokens_per_day: 10000,
    total_token_used: 0,
    total_input_tokens_used: 0,
    total_output_tokens_used: 0,
  });

  const refreshUsage = useCallback(async (username) => {
    const data = await getUsage(username);
    setUsage(data);
  }, []);

  const handleLogin = async ({ username, password }) => {
    setIsLoading(true);
    setLoginError("");
    try {
      const data = await login({ username, password });
      setAuthUser(data.username);
      await refreshUsage(data.username);
      setMessages([]);
    } catch (error) {
      const detail = error?.response?.data?.detail || "Dang nhap that bai.";
      setLoginError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (text) => {
    if (!authUser?.trim()) return;

    const userMessage = {
      id: createId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const data = await sendChatMessage({
        username: authUser,
        message: text,
      });

      const assistantMessage = {
        id: createId(),
        role: "assistant",
        content: data.reply,
        usage: data.usage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await refreshUsage(authUser);
    } catch (error) {
      const detail = error?.response?.data?.detail || "Co loi khi goi API chat.";
      const errorMessage = {
        id: createId(),
        role: "assistant",
        content: `❌ ${detail}`,
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
      messages={messages}
      isLoading={isLoading}
      onSendMessage={handleSendMessage}
      totalTokenUsed={usage.total_token_used}
      inputTokenUsed={usage.total_input_tokens_used}
      outputTokenUsed={usage.total_output_tokens_used}
      maxTokensPerDay={usage.max_tokens_per_day}
    />
  );
}
