import { useEffect, useState } from "react";
import styles from "./Login.module.css";

export default function Login({ onLogin, isLoading, error }) {
  const DEFAULT_USERNAME = "test_user";
  const DEFAULT_PASSWORD = "123456";

  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);

  useEffect(() => {
    setUsername(DEFAULT_USERNAME);
    setPassword(DEFAULT_PASSWORD);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await onLogin({ username: username.trim(), password });
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Dominic</h1>
        <p className={styles.subtitle}>Dang nhap de bat dau chat</p>

        <label className={styles.label} htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          autoComplete="off"
          className={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nhap username"
        />

        <label className={styles.label} htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          autoComplete="off"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nhap password"
        />

        {error ? <div className={styles.error}>{error}</div> : null}

        <button className={styles.button} type="submit" disabled={isLoading}>
          {isLoading ? "Dang dang nhap..." : "Dang nhap"}
        </button>

        <p className={styles.hint}>Co the mo rong sang Dang ky bang cach them endpoint /register sau nay.</p>
      </form>
    </div>
  );
}

