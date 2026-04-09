import Sidebar from "../Sidebar/Sidebar";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatInput from "../ChatInput/ChatInput";
import styles from "./App.module.css";

export default function App({
  username,
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
  onLogout,
  messages,
  isLoading,
  onSendMessage,
  totalTokenUsed = 0,
  inputTokenUsed = 0,
  outputTokenUsed = 0,
  lifetimeTotalTokenUsed = 0,
  lifetimeInputTokenUsed = 0,
  lifetimeOutputTokenUsed = 0,
  rollingWindowHours = 2,
  maxTokensPerDay = 10000,
}) {
  return (
    <div className={styles.layout}>
      <Sidebar
        username={username}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onCreateSession={onCreateSession}
        onSelectSession={onSelectSession}
        onLogout={onLogout}
        totalTokenUsed={totalTokenUsed}
        inputTokenUsed={inputTokenUsed}
        outputTokenUsed={outputTokenUsed}
        lifetimeTotalTokenUsed={lifetimeTotalTokenUsed}
        lifetimeInputTokenUsed={lifetimeInputTokenUsed}
        lifetimeOutputTokenUsed={lifetimeOutputTokenUsed}
        rollingWindowHours={rollingWindowHours}
        maxTokensPerDay={maxTokensPerDay}
      />

      <main className={styles.main}>
        <ChatWindow messages={messages} isLoading={isLoading} />
        <ChatInput
          disabled={!username || isLoading}
          onSendMessage={onSendMessage}
        />
      </main>
    </div>
  );
}
