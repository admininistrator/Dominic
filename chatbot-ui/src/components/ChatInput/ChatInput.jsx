import { useRef, useState } from "react";
import styles from "./ChatInput.module.css";

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;

const IconImage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="9" cy="9" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22 11 13 2 9z" />
  </svg>
);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data-URI
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatInput({ onSendMessage, disabled }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]); // [{dataUri, name, type}]
  const fileInputRef = useRef(null);

  const submit = () => {
    const value = text.trim();
    if ((!value && images.length === 0) || disabled) return;
    onSendMessage(value, images.map((i) => ({ dataUri: i.dataUri, type: i.type })));
    setText("");
    setImages([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFiles = async (files) => {
    const allowed = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const toAdd = allowed.slice(0, remaining);
    const invalid = toAdd.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (invalid.length) {
      alert(`Ảnh quá lớn (tối đa ${MAX_SIZE_MB}MB): ${invalid.map((f) => f.name).join(", ")}`);
      return;
    }
    const encoded = await Promise.all(
      toAdd.map(async (f) => ({ dataUri: await fileToBase64(f), name: f.name, type: f.type }))
    );
    setImages((prev) => [...prev, ...encoded].slice(0, MAX_IMAGES));
  };

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles = items
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile());
    if (imageFiles.length) handleFiles(imageFiles);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formInner}>
        {images.length > 0 && (
          <div className={styles.imagePreview}>
            {images.map((img, idx) => (
              <div key={idx} className={styles.imageThumb}>
                <img src={img.dataUri} alt={img.name} />
                <button
                  type="button"
                  className={styles.imageRemove}
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  title="Xóa ảnh"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.inputRow}>
          <button
            type="button"
            className={styles.imageButton}
            title={`Đính kèm ảnh (tối đa ${MAX_IMAGES})`}
            disabled={disabled || images.length >= MAX_IMAGES}
            onClick={() => fileInputRef.current?.click()}
          >
            <IconImage />
          </button>
          <textarea
            className={styles.textarea}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Nhắn Dominic..."
            disabled={disabled}
          />
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={disabled} title="Gửi">
              <IconSend />
            </button>
          </div>
        </div>
        <p className={styles.hint}>Enter để gửi · Shift + Enter để xuống dòng · hỗ trợ upload ảnh</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </form>
  );
}
