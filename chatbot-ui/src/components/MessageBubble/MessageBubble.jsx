import ReactMarkdown from "react-markdown";
import styles from "./MessageBubble.module.css";

export default function MessageBubble({ role, content, usage }) {
  const isUser = role === "user";

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        <div className={styles.role}>{isUser ? "Bạn" : "AI"}</div>

        {isUser ? (
          <p className={styles.plain}>{content}</p>
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

        {usage && !isUser && (
          <div className={styles.usage}>
            in: {usage.input_tokens} | out: {usage.output_tokens}
          </div>
        )}
      </div>
    </div>
  );
}
