import Sidebar from "../Sidebar/Sidebar";
import styles from "./App.module.css";

export default function App({
  user,
  activeView,
  onChangeView,
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onLogout,
  onChangePassword,
  passwordPolicyHint,
  isPasswordBusy,
  totalTokenUsed = 0,
  inputTokenUsed = 0,
  outputTokenUsed = 0,
  lifetimeTotalTokenUsed = 0,
  lifetimeInputTokenUsed = 0,
  lifetimeOutputTokenUsed = 0,
  rollingWindowHours = 2,
  maxTokensPerDay = 10000,
  children,
}) {
  return (
    <div className={styles.layout}>
      <Sidebar
        user={user}
        activeView={activeView}
        onChangeView={onChangeView}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onCreateSession={onCreateSession}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        onRenameSession={onRenameSession}
        onLogout={onLogout}
        onChangePassword={onChangePassword}
        passwordPolicyHint={passwordPolicyHint}
        isPasswordBusy={isPasswordBusy}
        totalTokenUsed={totalTokenUsed}
        inputTokenUsed={inputTokenUsed}
        outputTokenUsed={outputTokenUsed}
        lifetimeTotalTokenUsed={lifetimeTotalTokenUsed}
        lifetimeInputTokenUsed={lifetimeInputTokenUsed}
        lifetimeOutputTokenUsed={lifetimeOutputTokenUsed}
        rollingWindowHours={rollingWindowHours}
        maxTokensPerDay={maxTokensPerDay}
      />

      <main className={styles.main}>{children}</main>
    </div>
  );
}
