import { useState } from "react";
import styles from "./Sidebar.module.css";

// SVG Icons
const IconChat = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconKnowledge = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const IconAdmin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

function groupSessionsByDate(sessions) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const last7 = new Date(today); last7.setDate(today.getDate() - 7);
  const last30 = new Date(today); last30.setDate(today.getDate() - 30);
  const groups = { Today: [], Yesterday: [], "Last 7 Days": [], "Last 30 Days": [], Older: [] };
  for (const s of sessions) {
    const d = new Date(s.created_at || s.updated_at || 0);
    if (d >= today) groups["Today"].push(s);
    else if (d >= yesterday) groups["Yesterday"].push(s);
    else if (d >= last7) groups["Last 7 Days"].push(s);
    else if (d >= last30) groups["Last 30 Days"].push(s);
    else groups["Older"].push(s);
  }
  return groups;
}

export default function Sidebar({
  user, activeView, onChangeView,
  sessions, activeSessionId, onCreateSession, onSelectSession,
  onDeleteSession, onRenameSession,
  onLogout, onChangePassword, passwordPolicyHint, isPasswordBusy,
  totalTokenUsed, inputTokenUsed, outputTokenUsed,
  lifetimeTotalTokenUsed,
  rollingWindowHours = 2, maxTokensPerDay = 10000,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState({ type: "info", text: "" });

  const username = user?.username || "";
  const role = user?.role || "user";
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const used = Number(totalTokenUsed || 0);
  const max = Number(maxTokensPerDay || 10000);
  const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const isExceeded = used >= max;

  const filteredSessions = searchQuery.trim()
    ? safeSessions.filter(s => (s.title || `Session ${s.id}`).toLowerCase().includes(searchQuery.toLowerCase()))
    : safeSessions;
  const grouped = groupSessionsByDate(filteredSessions);

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setPasswordFeedback({ type: "error", text: "Vui lòng nhập đủ các trường." }); return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: "error", text: "Mật khẩu mới không khớp." }); return;
    }
    const result = await onChangePassword({ old_password: oldPassword, new_password: newPassword, confirm_new_password: confirmNewPassword });
    setPasswordFeedback({ type: result?.success ? "success" : "error", text: result?.message || (result?.success ? "Đổi thành công." : "Thất bại.") });
    if (result?.success) { setOldPassword(""); setNewPassword(""); setConfirmNewPassword(""); }
  };

  const startRename = (s, e) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditingTitle(s.title || "");
  };

  const commitRename = async (sessionId) => {
    if (editingTitle.trim() && onRenameSession) {
      await onRenameSession(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

  return (
    <aside className={styles.sidebar}>
      {/* ── Header: Brand ── */}
      <div className={styles.header}>
        <span className={styles.brand}>Dominic</span>
      </div>

      {/* ── New Chat + Search row ── */}
      {activeView === "chat" && (
        <div className={styles.actionRow}>
          <button className={styles.newChatBtn} onClick={onCreateSession} type="button">
            <span className={styles.newChatPlus}>+</span> New chat
          </button>
          <button
            className={`${styles.searchCircleBtn} ${searchOpen ? styles.searchCircleBtnActive : ""}`}
            title="Tìm kiếm"
            onClick={() => setSearchOpen(v => !v)}
            type="button"
          >
            <IconSearch />
          </button>
        </div>
      )}

      {/* ── Search bar ── */}
      {searchOpen && (
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            placeholder="Tìm hội thoại..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* ── Nav tabs ── */}
      <nav className={styles.nav}>
        <button className={`${styles.navItem} ${activeView === "chat" ? styles.navItemActive : ""}`} onClick={() => onChangeView("chat")}>
          <IconChat /> Chat
        </button>
        <button className={`${styles.navItem} ${activeView === "knowledge" ? styles.navItemActive : ""}`} onClick={() => onChangeView("knowledge")}>
          <IconKnowledge /> Knowledge
        </button>
        {role === "admin" && (
          <button className={`${styles.navItem} ${activeView === "admin" ? styles.navItemActive : ""}`} onClick={() => onChangeView("admin")}>
            <IconAdmin /> Admin
          </button>
        )}
      </nav>

      {/* ── Session list ── */}
      {activeView === "chat" && (
        <div className={styles.sessionArea}>
          <div className={styles.sessionPanel}>
            <div className={styles.conversationsLabel}>
              <span>Your conversations</span>
            </div>
            <div className={styles.sessionList}>
              {Object.entries(grouped).map(([group, items]) =>
                items.length === 0 ? null : (
                  <div key={group} className={styles.sessionGroup}>
                    <div className={styles.groupLabel}>{group}</div>
                    {items.map(s => (
                      <div
                        key={s.id}
                        className={`${styles.sessionItem} ${s.id === activeSessionId ? styles.sessionItemActive : ""}`}
                      >
                        {editingSessionId === s.id ? (
                          <input
                            className={styles.renameInput}
                            value={editingTitle}
                            autoFocus
                            onChange={e => setEditingTitle(e.target.value)}
                            onBlur={() => commitRename(s.id)}
                            onKeyDown={e => {
                              if (e.key === "Enter") commitRename(s.id);
                              if (e.key === "Escape") setEditingSessionId(null);
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <button
                            type="button"
                            className={styles.sessionBtn}
                            onClick={() => onSelectSession(s.id)}
                          >
                            <IconChat />
                            <span className={styles.sessionTitle}>{s.title || `Session ${s.id}`}</span>
                          </button>
                        )}
                        {s.id === activeSessionId && editingSessionId !== s.id && (
                          <span className={styles.activeDot} />
                        )}
                        <div className={styles.sessionActions}>
                          <button
                            className={styles.sessionActionBtn}
                            title="Đổi tên"
                            onClick={(e) => startRename(s, e)}
                            type="button"
                          >
                            <IconPencil />
                          </button>
                          <button
                            className={`${styles.sessionActionBtn} ${styles.sessionDeleteBtn}`}
                            title="Xóa"
                            onClick={(e) => { e.stopPropagation(); onDeleteSession?.(s.id); }}
                            type="button"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
              {filteredSessions.length === 0 && (
                <p className={styles.emptyMsg}>Không có hội thoại.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Quota bar ── */}
      <div className={styles.quotaBar}>
        <div className={styles.quotaTrack}>
          <div
            className={`${styles.quotaFill} ${isExceeded ? styles.quotaExceeded : percent >= 80 ? styles.quotaWarn : ""}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={styles.quotaText}>{percent}% quota</span>
      </div>

      {/* ── Bottom pill: Settings + User ── */}
      <div className={styles.bottomPill}>
        <button className={styles.settingsBtn} onClick={() => setSettingsOpen(v => !v)} type="button">
          <IconSettings /> Settings
        </button>
        <div className={styles.dividerH} />
        <div className={styles.userRow}>
          <div className={styles.avatar}>{username.charAt(0).toUpperCase()}</div>
          <span className={styles.usernameText}>{username}</span>
          <button className={styles.logoutIconBtn} onClick={onLogout} title="Đăng xuất" type="button">
            <IconLogout />
          </button>
        </div>
      </div>

      {/* ── Settings panel (slide-up overlay) ── */}
      {settingsOpen && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsPanelHeader}>
            <span>Settings</span>
            <button className={styles.iconBtn} onClick={() => setSettingsOpen(false)}>✕</button>
          </div>
          <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>Quota ({rollingWindowHours}h rolling)</p>
            <p className={styles.settingsStat}>Used: {used} / {max}</p>
            <p className={styles.settingsStat}>Input: {inputTokenUsed} · Output: {outputTokenUsed}</p>
            <p className={styles.settingsStat}>Lifetime: {Number(lifetimeTotalTokenUsed || 0)}</p>
          </div>
          <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>Đổi mật khẩu</p>
            <form className={styles.passwordForm} onSubmit={handleChangePasswordSubmit}>
              <input className={styles.settingsInput} type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Mật khẩu hiện tại" autoComplete="current-password" disabled={isPasswordBusy} />
              <input className={styles.settingsInput} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mật khẩu mới" autoComplete="new-password" disabled={isPasswordBusy} />
              <input className={styles.settingsInput} type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Xác nhận mật khẩu mới" autoComplete="new-password" disabled={isPasswordBusy} />
              <button className={styles.settingsSaveBtn} type="submit" disabled={isPasswordBusy}>
                {isPasswordBusy ? "Đang đổi..." : "Lưu"}
              </button>
            </form>
            {passwordFeedback.text && (
              <div className={`${styles.feedback} ${passwordFeedback.type === "error" ? styles.feedbackError : styles.feedbackSuccess}`}>
                {passwordFeedback.text}
              </div>
            )}
            {passwordPolicyHint && <p className={styles.policyHint}>{passwordPolicyHint}</p>}
          </div>
        </div>
      )}
    </aside>
  );
}
