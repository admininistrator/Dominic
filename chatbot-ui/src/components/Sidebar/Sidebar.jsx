import styles from "./Sidebar.module.css";

export default function Sidebar({
  username,
  totalTokenUsed,
  inputTokenUsed,
  outputTokenUsed,
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
      </div>

      <div className={styles.block}>
        <p className={styles.stat}>Total used: {used}</p>
        <p className={styles.stat}>Input used: {inputTokenUsed}</p>
        <p className={styles.stat}>Output used: {outputTokenUsed}</p>
        <p className={styles.stat}>Limit/day: {max}</p>
        <p className={styles.stat}>Remaining: {remain}</p>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.progressText}>{percent}%</span>
        </div>

        {(isWarning || isExceeded) && (
          <div className={`${styles.quotaWarning} ${isExceeded ? styles.exceeded : styles.warning}`}>
            {isExceeded ? "Quota da vuot gioi han ngay." : "Sap cham quota ngay (>= 80%)."}
          </div>
        )}
      </div>
    </aside>
  );
}
