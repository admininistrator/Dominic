import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DOMINIC_AVATAR_ICON } from "../../assets/icons";
import MessageBubble from "../MessageBubble/MessageBubble";
import styles from "./ChatWindow.module.css";

const THINKING_STEPS = [
  "Dominic đang đọc ngữ cảnh và nối lại mạch hội thoại.",
  "Đang đối chiếu tài liệu liên quan trước khi trả lời.",
  "Đang biên soạn câu trả lời rõ ràng và sát ngữ cảnh hơn.",
];

function ThinkingBubble() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % THINKING_STEPS.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={styles.thinkingRow} aria-live="polite" aria-label="Dominic đang suy nghĩ">
      <div className={styles.thinkingAvatar}>
        <img src={DOMINIC_AVATAR_ICON} alt="" className={styles.thinkingAvatarImage} />
      </div>
      <div className={styles.thinkingCard}>
        <div className={styles.thinkingHeader}>
          <span className={styles.thinkingLabel}>Dominic</span>
          <span className={styles.thinkingStatus}>đang suy nghĩ</span>
        </div>

        <div className={styles.thinkingOrbit}>
          <span className={styles.thinkingDot} />
          <span className={styles.thinkingDot} />
          <span className={styles.thinkingDot} />
        </div>

        <p className={styles.thinkingMessage}>{THINKING_STEPS[stepIndex]}</p>

        <div className={styles.thinkingSkeleton}>
          <span className={`${styles.thinkingLine} ${styles.thinkingLineWide}`} />
          <span className={`${styles.thinkingLine} ${styles.thinkingLineMid}`} />
          <span className={`${styles.thinkingLine} ${styles.thinkingLineShort}`} />
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, isLoading, scopedDocuments = [], sessionTitle = "" }) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const visibleScopedDocuments = useMemo(
    () => (Array.isArray(scopedDocuments) ? scopedDocuments.filter(Boolean) : []),
    [scopedDocuments]
  );
  const normalizedSessionTitle = typeof sessionTitle === "string" ? sessionTitle.trim() : "";

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
        <div className={styles.topBarInner}>
          <div className={styles.topBarBadge}>Dominic</div>
          {normalizedSessionTitle ? (
            <h1 className={styles.chatTitle} title={normalizedSessionTitle}>{normalizedSessionTitle}</h1>
          ) : null}
        </div>
      </div>

      {visibleScopedDocuments.length > 0 && (
        <div className={styles.scopeBanner}>
          <div className={styles.scopeBannerInner}>
            Chat đang ưu tiên tài liệu: {" "}
            <strong>
              {visibleScopedDocuments.map((document) => document.title).join(", ")}
            </strong>
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
                documents={msg.documents}
                sources={msg.sources}
                assistantMeta={msg.assistantMeta}
                animate={msg.animate}
              />
            ))}
            {isLoading && <ThinkingBubble />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </section>
  );
}
