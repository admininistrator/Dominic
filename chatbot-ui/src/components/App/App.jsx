import Sidebar from "../Sidebar/Sidebar";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatInput from "../ChatInput/ChatInput";
import styles from "./App.module.css";

export default function App({
  username,
  messages,
  isLoading,
  onSendMessage,
  totalTokenUsed = 0,
  inputTokenUsed = 0,
  outputTokenUsed = 0,
  maxTokensPerDay = 10000,
}) {
  return (
    <div className={styles.layout}>
      <Sidebar
        username={username}
        totalTokenUsed={totalTokenUsed}
        inputTokenUsed={inputTokenUsed}
        outputTokenUsed={outputTokenUsed}
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
