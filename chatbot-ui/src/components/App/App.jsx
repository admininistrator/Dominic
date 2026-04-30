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
  onLogout,
  onChangePassword,
  theme,
  onThemeChange,
  isPasswordBusy,
  totalTokenUsed = 0,
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
        onLogout={onLogout}
        onChangePassword={onChangePassword}
        theme={theme}
        onThemeChange={onThemeChange}
        isPasswordBusy={isPasswordBusy}
        totalTokenUsed={totalTokenUsed}
        maxTokensPerDay={maxTokensPerDay}
      />

      <main className={styles.main}>{children}</main>
    </div>
  );
}
