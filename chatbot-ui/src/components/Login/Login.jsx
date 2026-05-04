import { AnimatePresence, motion as Motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import styles from "./Login.module.css";

const LAYOUT_SPRING = {
  type: "spring",
  stiffness: 210,
  damping: 26,
  mass: 0.92,
};

const FORM_PANEL_VARIANTS = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.24,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      staggerChildren: 0.055,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.985,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
};

const FORM_SECTION_VARIANTS = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
  exit: {},
};

const FORM_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(4px)",
    transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
  },
};

const CONFIRM_FIELD_VARIANTS = {
  hidden: { opacity: 0, y: 6, filter: "blur(2px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -4,
    filter: "blur(2px)",
    transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
  },
};

const HEADER_PANEL_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

const MODE_SWITCH_MOTION = {
  initial: { opacity: 0, y: 10, scale: 0.992 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.992 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
};

const PANEL_ENTER_MOTION = {
  initial: { opacity: 0, y: 18, scale: 0.992 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
};

const AUTH_TITLE_TYPING_ENTER_MS = 20;
const AUTH_TITLE_TYPING_DELETE_MS = 14;
const PASSWORD_RULE_HINT = "8-16 ký tự";

const TYPEWRITER_TRANSITION = {
  enterMs: AUTH_TITLE_TYPING_ENTER_MS,
  deleteMs: AUTH_TITLE_TYPING_DELETE_MS,
};

const SHOWCASE_MODE_MOTION = {
  initial: { opacity: 0, y: 14, scale: 0.99, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, scale: 0.992, filter: "blur(6px)" },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};

const SHOWCASE_CONTENT_BY_MODE = {
  login: {
    title: "Cùng một không gian, cùng một nhịp với màn hình chat.",
    text: "Truy cập trợ lý nội bộ, tri thức đã nạp và toàn bộ lịch sử hội thoại trong cùng một giao diện kính mờ như khu vực chat hiện tại.",
    pills: ["Realtime assistant", "Knowledge search", "Account controls"],
    previewUser: "Tóm tắt những điểm chính từ tài liệu đã nạp.",
    previewAssistant: "Tôi đang tổng hợp câu trả lời từ knowledge base và lịch sử hội thoại của bạn.",
  },
  register: {
    title: "Tạo tài khoản mới để bước vào Dominic với cùng nhịp làm việc đã sẵn sàng.",
    text: "Đăng ký để mở không gian chat, knowledge và lịch sử hội thoại riêng trong cùng một giao diện làm việc thống nhất.",
    pills: ["Workspace onboarding", "Private access", "Ready to chat"],
    previewUser: "Tôi muốn tạo tài khoản để bắt đầu làm việc trong Dominic.",
    previewAssistant: "Thiết lập tài khoản mới, rồi bước thẳng vào workspace với chat và knowledge đã sẵn sàng cho bạn.",
  },
  forgot: {
    title: "Khôi phục quyền truy cập mà không đánh rơi nhịp làm việc đang có.",
    text: "Dùng reset token để quay lại workspace nhanh hơn, rồi tiếp tục đoạn chat, tài liệu và tri thức đang chờ bạn ở cùng một chỗ.",
    pills: ["Reset token", "Secure recovery", "Back to workspace"],
    previewUser: "Tôi cần lấy lại quyền truy cập để tiếp tục đoạn chat đang dở.",
    previewAssistant: "Xác thực token, đặt lại mật khẩu mới và quay lại đúng nhịp làm việc cũ của bạn.",
  },
};

function useTypewriterText(targetText, { enabled = true, enterMs = 20, deleteMs = 14 } = {}) {
  const [text, setText] = useState(() => (enabled ? "" : targetText));
  const currentTextRef = useRef(enabled ? "" : targetText);
  const timeoutRef = useRef(null);

  useEffect(() => {
    currentTextRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!enabled) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        currentTextRef.current = targetText;
        setText(targetText);
      }, 0);
      return () => window.clearTimeout(timeoutRef.current);
    }

    const currentText = currentTextRef.current;
    if (currentText === targetText) {
      return undefined;
    }

    let cancelled = false;

    const schedule = (callback, delay) => {
      timeoutRef.current = window.setTimeout(callback, delay);
    };

    let deleteIndex = currentText.length;

    const typeStep = (index) => {
      if (cancelled) return;

      const nextText = targetText.slice(0, index);
      currentTextRef.current = nextText;
      setText(nextText);
      if (index >= targetText.length) {
        return;
      }

      schedule(() => typeStep(index + 1), enterMs);
    };

    const deleteStep = () => {
      if (cancelled) return;

      if (deleteIndex <= 0) {
        typeStep(1);
        return;
      }

      deleteIndex -= 1;
      const nextText = currentText.slice(0, deleteIndex);
      currentTextRef.current = nextText;
      setText(nextText);
      schedule(deleteStep, deleteMs);
    };

    deleteStep();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutRef.current);
    };
  }, [deleteMs, enabled, enterMs, targetText]);

  return {
    text: enabled ? text : targetText,
    isAnimating: enabled && text !== targetText,
  };
}

const EyeIcon = ({ visible }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
    <circle cx="12" cy="12" r="3" />
    {visible ? null : <path d="M4 4l16 16" />}
  </svg>
);

function TypewriterText({ text, isAnimating, className }) {
  return (
    <span className={className}>
      {text}
      {isAnimating ? <span className={styles.typewriterCaret} aria-hidden="true" /> : null}
    </span>
  );
}

export default function Login({ onLogin, onRegister, onResetPassword, isLoading, isBootstrapping, error }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [clientError, setClientError] = useState("");

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setClientError("");
    setServerMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      setClientError("Vui lòng nhập username.");
      return;
    }

    if (mode === "register") {
      if (!password) {
        setClientError("Vui lòng nhập mật khẩu.");
        return;
      }
      if (password !== confirmPassword) {
        setClientError("Xác nhận mật khẩu không khớp.");
        return;
      }
      setClientError("");
      setServerMessage("");
      await onRegister({ username: normalizedUsername, password, confirmPassword });
      return;
    }

    if (mode === "forgot") {
      if (!resetToken.trim() || !password || !confirmPassword) {
        setClientError("Vui lòng nhập username, reset token và mật khẩu mới.");
        return;
      }
      if (password !== confirmPassword) {
        setClientError("Xác nhận mật khẩu mới không khớp.");
        return;
      }

      setClientError("");
      const result = await onResetPassword({
        username: normalizedUsername,
        reset_token: resetToken.trim(),
        new_password: password,
        confirm_new_password: confirmPassword,
      });

      if (result?.success) {
        setServerMessage(result.message || "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.");
        setPassword("");
        setConfirmPassword("");
        setResetToken("");
        setMode("login");
      } else {
        setClientError(result?.message || "Đặt lại mật khẩu thất bại.");
      }
      return;
    }

    if (!password) {
      setClientError("Vui lòng nhập mật khẩu.");
      return;
    }

    setClientError("");
    setServerMessage("");
    await onLogin({ username: normalizedUsername, password });
  };

  const displayError = clientError || error;
  const isForgotMode = mode === "forgot";
  const isRegisterMode = mode === "register";
  const isPasswordCreationMode = isRegisterMode || isForgotMode;
  const showcaseModeKey = isForgotMode ? "forgot" : "auth";
  const authSurfaceKey = isForgotMode ? "forgot" : "auth";
  const showcaseContent = SHOWCASE_CONTENT_BY_MODE[mode] || SHOWCASE_CONTENT_BY_MODE.login;
  const { text: animatedShowcaseTitle, isAnimating: isShowcaseTitleAnimating } = useTypewriterText(
    showcaseContent.title,
    {
      enabled: true,
      ...TYPEWRITER_TRANSITION,
    }
  );
  const { text: animatedPreviewUser, isAnimating: isPreviewUserAnimating } = useTypewriterText(
    showcaseContent.previewUser,
    {
      enabled: true,
      enterMs: 18,
      deleteMs: 12,
    }
  );
  const { text: animatedPreviewAssistant, isAnimating: isPreviewAssistantAnimating } = useTypewriterText(
    showcaseContent.previewAssistant,
    {
      enabled: true,
      enterMs: 16,
      deleteMs: 11,
    }
  );

  return (
    <div className={styles.page}>
      <div className={styles.orbA} />
      <div className={styles.orbB} />
      <Motion.div
        className={styles.shell}
        layout
        transition={LAYOUT_SPRING}
        initial={PANEL_ENTER_MOTION.initial}
        animate={PANEL_ENTER_MOTION.animate}
      >
        <Motion.section className={styles.showcase} layout transition={LAYOUT_SPRING}>
          <div className={styles.brandRow}>
            <span className={styles.brandMark}>D</span>
            <div className={styles.brandCopy}>
              <p className={styles.eyebrow}>Dominic Workspace</p>
              <h1 className={`${styles.heroTitle} ${styles.heroTitleAuthBox}`}>
                <TypewriterText
                  text={animatedShowcaseTitle}
                  isAnimating={isShowcaseTitleAnimating}
                  className={styles.heroTitleTypingText}
                />
              </h1>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <Motion.div
              key={`showcase-${showcaseModeKey}`}
              className={styles.showcaseModeLayer}
              initial={SHOWCASE_MODE_MOTION.initial}
              animate={SHOWCASE_MODE_MOTION.animate}
              exit={SHOWCASE_MODE_MOTION.exit}
              transition={SHOWCASE_MODE_MOTION.transition}
            >
              <Motion.div className={styles.showcaseIntro} layout transition={LAYOUT_SPRING}>
                <p className={styles.heroText}>{showcaseContent.text}</p>

                <div className={styles.featureRow}>
                  {showcaseContent.pills.map((pill) => (
                    <span key={pill} className={styles.featurePill}>{pill}</span>
                  ))}
                </div>
              </Motion.div>

              <Motion.div className={styles.previewCard} layout transition={LAYOUT_SPRING}>
                <div className={styles.previewHeader}>
                  <span className={styles.previewDot} />
                  <span className={styles.previewDot} />
                  <span className={styles.previewDot} />
                </div>
                <div className={styles.previewTimeline}>
                  <div className={`${styles.previewBubble} ${styles.previewBubbleUser}`}>
                    <TypewriterText
                      text={animatedPreviewUser}
                      isAnimating={isPreviewUserAnimating}
                      className={styles.previewTypingText}
                    />
                  </div>
                  <div className={`${styles.previewBubble} ${styles.previewBubbleAssistant}`}>
                    <TypewriterText
                      text={animatedPreviewAssistant}
                      isAnimating={isPreviewAssistantAnimating}
                      className={styles.previewTypingText}
                    />
                  </div>
                </div>
              </Motion.div>
            </Motion.div>
          </AnimatePresence>
        </Motion.section>

        <Motion.form className={styles.card} onSubmit={handleSubmit} layout transition={LAYOUT_SPRING}>
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div
              key={`header-${authSurfaceKey}`}
              className={styles.formHeader}
              initial={HEADER_PANEL_MOTION.initial}
              animate={HEADER_PANEL_MOTION.animate}
              exit={HEADER_PANEL_MOTION.exit}
              transition={HEADER_PANEL_MOTION.transition}
            >
              <div className={styles.formHeaderTop}>
                {isForgotMode ? (
                  <button
                    className={styles.backButton}
                    type="button"
                    onClick={() => switchMode("login")}
                    disabled={isLoading}
                    data-testid="forgot-back-button"
                  >
                    Quay lại đăng nhập
                  </button>
                ) : null}
                <div className={styles.formHeaderCopy}>
                  <p className={styles.formEyebrow}>Secure Access</p>
                  <h2 className={styles.title}>{isForgotMode ? "Quên mật khẩu" : "Dominic"}</h2>
                </div>
              </div>
              {isForgotMode ? (
                <Motion.p
                  className={styles.subtitle}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  Đặt lại mật khẩu bằng reset token do admin cấp
                </Motion.p>
              ) : (
                <p className={styles.subtitle}>
                  {mode === "login"
                    ? "Đăng nhập để quay lại màn hình chat"
                    : "Tạo tài khoản mới cho workspace"}
                </p>
              )}
            </Motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            {!isForgotMode ? (
              <Motion.div
                key="auth-modes"
                className={styles.modeSwitch}
                initial={MODE_SWITCH_MOTION.initial}
                animate={MODE_SWITCH_MOTION.animate}
                exit={MODE_SWITCH_MOTION.exit}
                transition={MODE_SWITCH_MOTION.transition}
              >
                <button
                  className={`${styles.modeBtn} ${mode === "login" ? styles.modeBtnActive : ""}`}
                  type="button"
                  onClick={() => switchMode("login")}
                  disabled={isLoading}
                  data-testid="login-mode-button"
                >
                  {mode === "login" ? <Motion.span layoutId="auth-mode-highlight" className={styles.modeBtnGlow} transition={{ type: "spring", stiffness: 360, damping: 30 }} /> : null}
                  <span className={styles.modeBtnText}>Đăng nhập</span>
                </button>
                <button
                  className={`${styles.modeBtn} ${mode === "register" ? styles.modeBtnActive : ""}`}
                  type="button"
                  onClick={() => switchMode("register")}
                  disabled={isLoading}
                  data-testid="register-mode-button"
                >
                  {mode === "register" ? <Motion.span layoutId="auth-mode-highlight" className={styles.modeBtnGlow} transition={{ type: "spring", stiffness: 360, damping: 30 }} /> : null}
                  <span className={styles.modeBtnText}>Đăng ký</span>
                </button>
              </Motion.div>
            ) : (
              <Motion.div
                key="forgot-state"
                className={styles.modeStatePill}
                initial={MODE_SWITCH_MOTION.initial}
                animate={MODE_SWITCH_MOTION.animate}
                exit={MODE_SWITCH_MOTION.exit}
                transition={MODE_SWITCH_MOTION.transition}
              >
                Reset access
              </Motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <Motion.div
              key={authSurfaceKey}
              className={styles.formBody}
              variants={FORM_PANEL_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
              transition={LAYOUT_SPRING}
            >
              <Motion.div className={styles.fields} variants={FORM_SECTION_VARIANTS}>
                <Motion.label className={styles.field} htmlFor="username" variants={FORM_ITEM_VARIANTS}>
                  <span className={styles.label}>Username</span>
                  <input
                    id="username"
                    name="username"
                    autoComplete="username"
                    className={styles.input}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (clientError) {
                        setClientError("");
                      }
                      if (serverMessage) {
                        setServerMessage("");
                      }
                    }}
                    placeholder="Nhập username"
                    disabled={isLoading}
                    data-testid="username-input"
                  />
                </Motion.label>

                <AnimatePresence initial={false}>
                  {isForgotMode ? (
                    <Motion.label
                      className={styles.field}
                      htmlFor="resetToken"
                      variants={FORM_ITEM_VARIANTS}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                    >
                      <span className={styles.label}>Reset token</span>
                      <input
                        id="resetToken"
                        name="resetToken"
                        className={styles.input}
                        value={resetToken}
                        onChange={(e) => {
                          setResetToken(e.target.value);
                          if (clientError) {
                            setClientError("");
                          }
                        }}
                        placeholder="Dán reset token do admin cấp"
                        disabled={isLoading}
                        data-testid="reset-token-input"
                      />
                    </Motion.label>
                  ) : null}
                </AnimatePresence>

                <Motion.label className={styles.field} htmlFor="password" variants={FORM_ITEM_VARIANTS}>
                  <span className={styles.label}>{isForgotMode ? "Mật khẩu mới" : "Password"}</span>
                  <div className={styles.inputWrap}>
                    <input
                      id="password"
                      name="password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      type={showPassword ? "text" : "password"}
                      className={`${styles.input} ${styles.inputWithAdornment}`}
                      minLength={isPasswordCreationMode ? 8 : undefined}
                      maxLength={isPasswordCreationMode ? 16 : undefined}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (clientError) {
                          setClientError("");
                        }
                        if (serverMessage) {
                          setServerMessage("");
                        }
                      }}
                      placeholder={isForgotMode ? `Mật khẩu mới (${PASSWORD_RULE_HINT})` : isRegisterMode ? `Mật khẩu (${PASSWORD_RULE_HINT})` : "Nhập password"}
                      disabled={isLoading}
                      data-testid="password-input"
                    />
                    <button
                      className={styles.passwordToggle}
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      aria-pressed={showPassword}
                      disabled={isLoading}
                    >
                      <EyeIcon visible={showPassword} />
                    </button>
                  </div>
                </Motion.label>

                <AnimatePresence initial={false}>
                  {isRegisterMode || isForgotMode ? (
                    <Motion.div
                      className={styles.confirmFieldPresence}
                      initial={{ height: 0, opacity: 0, y: 8 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -6 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Motion.label
                        className={styles.field}
                        htmlFor="confirmPassword"
                        variants={CONFIRM_FIELD_VARIANTS}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                      >
                        <span className={styles.label}>{isForgotMode ? "Xác nhận mật khẩu mới" : "Confirm password"}</span>
                        <div className={styles.inputWrap}>
                          <input
                            id="confirmPassword"
                            name="confirmPassword"
                            autoComplete="new-password"
                            type={showConfirmPassword ? "text" : "password"}
                            className={`${styles.input} ${styles.inputWithAdornment}`}
                            minLength={8}
                            maxLength={16}
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              if (clientError) {
                                setClientError("");
                              }
                              if (serverMessage) {
                                setServerMessage("");
                              }
                            }}
                            placeholder={isForgotMode ? "Nhập lại mật khẩu mới (8-16 ký tự)" : "Nhập lại mật khẩu (8-16 ký tự)"}
                            disabled={isLoading}
                            data-testid="confirm-password-input"
                          />
                          <button
                            className={styles.passwordToggle}
                            type="button"
                            onClick={() => setShowConfirmPassword((value) => !value)}
                            aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                            aria-pressed={showConfirmPassword}
                            disabled={isLoading}
                          >
                            <EyeIcon visible={showConfirmPassword} />
                          </button>
                        </div>
                      </Motion.label>
                    </Motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {mode === "login" ? (
                    <Motion.div
                      className={styles.inlineActionRow}
                      variants={FORM_ITEM_VARIANTS}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                    >
                      <button
                        className={styles.inlineLink}
                        type="button"
                        onClick={() => switchMode("forgot")}
                        disabled={isLoading}
                        data-testid="forgot-password-link"
                      >
                        Quên mật khẩu?
                      </button>
                    </Motion.div>
                  ) : null}
                </AnimatePresence>
              </Motion.div>

              <Motion.div className={styles.messageStack} variants={FORM_ITEM_VARIANTS}>
                {serverMessage ? <div className={styles.success}>{serverMessage}</div> : null}
                {displayError ? <div className={styles.error}>{displayError}</div> : null}
              </Motion.div>

              <Motion.button className={styles.button} type="submit" disabled={isLoading} data-testid="auth-submit-button" variants={FORM_ITEM_VARIANTS}>
                {isLoading
                  ? isBootstrapping
                    ? "Đang khôi phục phiên..."
                    : mode === "login"
                      ? "Đang đăng nhập..."
                      : mode === "register"
                        ? "Đang tạo tài khoản..."
                        : "Đang đặt lại mật khẩu..."
                  : mode === "login"
                    ? "Đăng nhập"
                    : mode === "register"
                      ? "Đăng ký"
                      : "Xác nhận reset"}
                </Motion.button>

                <Motion.p className={styles.hint} variants={FORM_ITEM_VARIANTS}>
                Phiên đăng nhập được lưu trên trình duyệt cho đến khi bạn đăng xuất hoặc token hết hạn.
                </Motion.p>
            </Motion.div>
          </AnimatePresence>
          </Motion.form>
        </Motion.div>
    </div>
  );
}

