import { useState } from "react";
import styles from "./ChatInput.module.css";

export default function ChatInput({ onSendMessage, disabled }) {
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSendMessage(value);
    setText("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    // Enter: gửi | Shift+Enter: xuống dòng
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        className={styles.textarea}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nhập prompt..."
        disabled={disabled}
      />
      <button className={styles.button} type="submit" disabled={disabled}>
        Gửi
      </button>
    </form>
  );
}
