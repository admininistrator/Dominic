import { useState } from "react";
import styles from "./Login.module.css";

export default function Login({ onLogin, onRegister, onResetPassword, isLoading, isBootstrapping, error }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [clientError, setClientError] = useState("");

  const switchMode = (nextMode) => {
    setMode(nextMode);
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

  return (
    <div className={styles.page}>
      <div className={styles.orbA} />
      <div className={styles.orbB} />
      <div className={styles.shell}>
        <section className={styles.showcase}>
          <div className={styles.brandRow}>
            <span className={styles.brandMark}>D</span>
            <div>
              <p className={styles.eyebrow}>Dominic Workspace</p>
              <h1 className={styles.heroTitle}>Cùng một không gian, cùng một nhịp với màn hình chat.</h1>
            </div>
          </div>

          <p className={styles.heroText}>
            Truy cập trợ lý nội bộ, tri thức đã nạp và toàn bộ lịch sử hội thoại trong cùng một giao diện kính mờ như khu vực chat hiện tại.
          </p>

          <div className={styles.featureRow}>
            <span className={styles.featurePill}>Realtime assistant</span>
            <span className={styles.featurePill}>Knowledge search</span>
            <span className={styles.featurePill}>Account controls</span>
          </div>

          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <span className={styles.previewDot} />
              <span className={styles.previewDot} />
              <span className={styles.previewDot} />
            </div>
            <div className={styles.previewTimeline}>
              <div className={`${styles.previewBubble} ${styles.previewBubbleUser}`}>
                Tóm tắt những điểm chính từ tài liệu đã nạp.
              </div>
              <div className={`${styles.previewBubble} ${styles.previewBubbleAssistant}`}>
                Tôi đang tổng hợp câu trả lời từ knowledge base và lịch sử hội thoại của bạn.
              </div>
            </div>
          </div>
        </section>

        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
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
              <div>
              <p className={styles.formEyebrow}>Secure Access</p>
                <h2 className={styles.title}>{isForgotMode ? "Quên mật khẩu" : "Dominic"}</h2>
              </div>
            </div>
            <p className={styles.subtitle}>
              {mode === "login"
                ? "Đăng nhập để quay lại màn hình chat"
                : mode === "register"
                  ? "Tạo tài khoản mới cho workspace"
                  : "Đặt lại mật khẩu bằng reset token do admin cấp"}
            </p>
          </div>

          {!isForgotMode ? (
            <div className={styles.modeSwitch}>
              <button
                className={`${styles.modeBtn} ${mode === "login" ? styles.modeBtnActive : ""}`}
                type="button"
                onClick={() => switchMode("login")}
                disabled={isLoading}
                data-testid="login-mode-button"
              >
                Đăng nhập
              </button>
              <button
                className={`${styles.modeBtn} ${mode === "register" ? styles.modeBtnActive : ""}`}
                type="button"
                onClick={() => switchMode("register")}
                disabled={isLoading}
                data-testid="register-mode-button"
              >
                Đăng ký
              </button>
            </div>
          ) : null}

          <div className={styles.fields}>
            <label className={styles.field} htmlFor="username">
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
            </label>

            {isForgotMode ? (
              <label className={styles.field} htmlFor="resetToken">
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
              </label>
            ) : null}

            <label className={styles.field} htmlFor="password">
              <span className={styles.label}>{isForgotMode ? "Mật khẩu mới" : "Password"}</span>
              <input
                id="password"
                name="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                type="password"
                className={styles.input}
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
                placeholder={isForgotMode ? "Nhập mật khẩu mới" : "Nhập password"}
                disabled={isLoading}
                data-testid="password-input"
              />
            </label>

            {isRegisterMode || isForgotMode ? (
              <label className={styles.field} htmlFor="confirmPassword">
                <span className={styles.label}>{isForgotMode ? "Xác nhận mật khẩu mới" : "Confirm password"}</span>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  type="password"
                  className={styles.input}
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
                  placeholder={isForgotMode ? "Nhập lại mật khẩu mới" : "Nhập lại password"}
                  disabled={isLoading}
                  data-testid="confirm-password-input"
                />
              </label>
            ) : null}

            {mode === "login" ? (
              <div className={styles.inlineActionRow}>
                <button
                  className={styles.inlineLink}
                  type="button"
                  onClick={() => switchMode("forgot")}
                  disabled={isLoading}
                  data-testid="forgot-password-link"
                >
                  Quên mật khẩu?
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.messageStack}>
            {serverMessage ? <div className={styles.success}>{serverMessage}</div> : null}
            {displayError ? <div className={styles.error}>{displayError}</div> : null}
            {isForgotMode ? (
              <div className={styles.infoAlt}>
                Luồng reset hiện tại theo backend: admin tạo reset token trong admin/reset-password, sau đó người dùng nhập token tại đây.
              </div>
            ) : null}
          </div>

          <button className={styles.button} type="submit" disabled={isLoading} data-testid="auth-submit-button">
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
          </button>

          <p className={styles.hint}>
            Phiên đăng nhập được lưu trên trình duyệt cho đến khi bạn đăng xuất hoặc token hết hạn.
          </p>
        </form>
      </div>
    </div>
  );
}

