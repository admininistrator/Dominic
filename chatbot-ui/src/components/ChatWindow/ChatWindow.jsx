import { useEffect, useRef } from "react";
import MessageBubble from "../MessageBubble/MessageBubble";
import styles from "./ChatWindow.module.css";

export default function ChatWindow({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <section className={styles.container}>
      {messages.length === 0 ? (
        <div className={styles.empty}>
          <p>Chưa có tin nhắn. Hãy bắt đầu cuộc hội thoại.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              usage={msg.usage}
            />
          ))}
          {isLoading && <div className={styles.loading}>AI đang trả lời...</div>}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  );
}
