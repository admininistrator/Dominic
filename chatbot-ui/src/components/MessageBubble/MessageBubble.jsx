import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TYPEWRITER_INTERVAL_MS } from "../../config/uiConfig";
import styles from "./MessageBubble.module.css";

export default function MessageBubble({ role, content, usage, animate = false }) {
  const isUser = role === "user";
  const [displayedContent, setDisplayedContent] = useState(isUser || !animate ? content : "");

  useEffect(() => {
    if (isUser || !animate) {
      setDisplayedContent(content);
      return;
    }

    let idx = 0;
    setDisplayedContent("");
    const timer = setInterval(() => {
      idx += 1;
      setDisplayedContent(content.slice(0, idx));
      if (idx >= content.length) {
        clearInterval(timer);
      }
    }, TYPEWRITER_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [content, isUser, animate]);

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        <div className={styles.role}>{isUser ? "You" : "Dominic"}</div>

        {isUser ? (
          <p className={styles.plain}>{displayedContent}</p>
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown>{displayedContent}</ReactMarkdown>
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
