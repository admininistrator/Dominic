import styles from "./Sidebar.module.css";

export default function Sidebar({
  username,
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
  onLogout,
  totalTokenUsed,
  inputTokenUsed,
  outputTokenUsed,
  lifetimeTotalTokenUsed,
  lifetimeInputTokenUsed,
  lifetimeOutputTokenUsed,
  rollingWindowHours = 2,
  maxTokensPerDay = 10000,
}) {
  const used = Number(totalTokenUsed || 0);
  const max = Number(maxTokensPerDay || 10000);
  const remain = Math.max(0, max - used);
  const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const isWarning = percent >= 80 && percent < 100;
  const isExceeded = used >= max;

  return (
    <aside className={styles.sidebar}>
      <h1 className={styles.title}>Dominic</h1>

      <div className={styles.block}>
        <p className={styles.label}>Dang nhap voi user</p>
        <p className={styles.username}>{username}</p>
        <button className={styles.logoutBtn} onClick={onLogout} type="button">
          Log out
        </button>
      </div>

      <div className={styles.block}>
        <button className={styles.newChatBtn} onClick={onCreateSession} type="button">
          + New chat
        </button>
        <div className={styles.sessionList}>
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.sessionBtn} ${s.id === activeSessionId ? styles.sessionBtnActive : ""}`}
              onClick={() => onSelectSession(s.id)}
            >
              {s.title || `Session ${s.id}`}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.sectionTitle}>Quota hien tai (rolling {rollingWindowHours}h)</p>
        <p className={styles.stat}>Used: {used}</p>
        <p className={styles.stat}>Input: {inputTokenUsed}</p>
        <p className={styles.stat}>Output: {outputTokenUsed}</p>
        <p className={styles.stat}>Limit/{rollingWindowHours}h: {max}</p>
        <p className={styles.stat}>Remaining: {remain}</p>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.progressText}>{percent}%</span>
        </div>

        {(isWarning || isExceeded) && (
          <div className={`${styles.quotaWarning} ${isExceeded ? styles.exceeded : styles.warning}`}>
            {isExceeded
              ? `Quota ${rollingWindowHours}h da vuot gioi han.`
              : `Sap cham quota ${rollingWindowHours}h (>= 80%).`}
          </div>
        )}
      </div>

      <div className={styles.block}>
        <p className={styles.sectionTitle}>Tong tich luy (lifetime)</p>
        <p className={styles.stat}>Total used: {Number(lifetimeTotalTokenUsed || 0)}</p>
        <p className={styles.stat}>Input used: {Number(lifetimeInputTokenUsed || 0)}</p>
        <p className={styles.stat}>Output used: {Number(lifetimeOutputTokenUsed || 0)}</p>
      </div>
    </aside>
  );
}
