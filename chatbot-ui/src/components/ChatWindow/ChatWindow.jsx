import { useLayoutEffect, useRef } from "react";
import MessageBubble from "../MessageBubble/MessageBubble";
import styles from "./ChatWindow.module.css";

export default function ChatWindow({ messages, isLoading, scopedDocument = null }) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollToLatest = () => {
      container.scrollTop = container.scrollHeight;
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    };

    const rafId = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(rafId);
  }, [messages.length, isLoading]);

  return (
    <section className={styles.container} ref={containerRef}>
      <div className={styles.topBar}>
        <div className={styles.topBarBadge}>Dominic</div>
      </div>

      {scopedDocument && (
        <div className={styles.scopeBanner}>
          <div className={styles.scopeBannerInner}>
            Chat đang ưu tiên knowledge document: <strong>{scopedDocument.title}</strong> (#{scopedDocument.id})
          </div>
        </div>
      )}
      <div className={styles.inner}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyHint}>
              <span className={styles.emptyEyebrow}>Dominic workspace</span>
              <h2>Bắt đầu một cuộc trò chuyện mới</h2>
              <p>
                Gửi câu hỏi, đính kèm ảnh hoặc chọn tài liệu trong knowledge base để Dominic
                trả lời theo đúng ngữ cảnh.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                images={msg.images}
                sources={msg.sources}
                retrieval={msg.retrieval}
                usage={msg.usage}
                animate={msg.animate}
              />
            ))}
            {isLoading && <div className={styles.loading}>Dominic đang trả lời...</div>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </section>
  );
}
