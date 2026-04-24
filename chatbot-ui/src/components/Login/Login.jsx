import { useState } from "react";
import styles from "./Login.module.css";

const PASSWORD_HINT =
  "Theo backend hiện tại: mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt và tối đa 64 ký tự.";

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

    if (mode === "reset") {
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

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Dominic</h1>
        <p className={styles.subtitle}>
          {mode === "login"
            ? "Đăng nhập để bắt đầu chat"
            : mode === "register"
              ? "Tạo tài khoản mới để bắt đầu chat"
              : "Đặt lại mật khẩu bằng reset token do admin cấp"}
        </p>

        <div className={styles.modeSwitch}>
          <button
            className={`${styles.modeBtn} ${mode === "login" ? styles.modeBtnActive : ""}`}
            type="button"
            onClick={() => switchMode("login")}
            disabled={isLoading}
          >
            Đăng nhập
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "register" ? styles.modeBtnActive : ""}`}
            type="button"
            onClick={() => switchMode("register")}
            disabled={isLoading}
          >
            Đăng ký
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "reset" ? styles.modeBtnActive : ""}`}
            type="button"
            onClick={() => switchMode("reset")}
            disabled={isLoading}
          >
            Reset password
          </button>
        </div>

        <label className={styles.label} htmlFor="username">Username</label>
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
        />

        {mode === "reset" ? (
          <>
            <label className={styles.label} htmlFor="resetToken">Reset token</label>
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
            />
          </>
        ) : null}

        <label className={styles.label} htmlFor="password">
          {mode === "reset" ? "Mật khẩu mới" : "Password"}
        </label>
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
          placeholder={mode === "reset" ? "Nhập mật khẩu mới" : "Nhập password"}
          disabled={isLoading}
        />

        {mode === "register" || mode === "reset" ? (
          <>
            <label className={styles.label} htmlFor="confirmPassword">
              {mode === "reset" ? "Xác nhận mật khẩu mới" : "Confirm password"}
            </label>
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
              placeholder={mode === "reset" ? "Nhập lại mật khẩu mới" : "Nhập lại password"}
              disabled={isLoading}
            />
          </>
        ) : null}

        {serverMessage ? <div className={styles.success}>{serverMessage}</div> : null}
        {displayError ? <div className={styles.error}>{displayError}</div> : null}

        {mode === "register" || mode === "reset" ? (
          <div className={styles.info}>
            {PASSWORD_HINT}
          </div>
        ) : null}

        {mode === "reset" ? (
          <div className={styles.infoAlt}>
            Luồng reset hiện tại theo backend: admin tạo reset token trong `admin/reset-password`, sau đó người dùng nhập token tại đây.
          </div>
        ) : null}

        <button className={styles.button} type="submit" disabled={isLoading}>
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
  );
}

