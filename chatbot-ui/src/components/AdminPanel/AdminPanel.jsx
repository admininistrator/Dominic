import { useState } from "react";
import styles from "./AdminPanel.module.css";
import { formatDate } from "../../utils/formatters";

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function renderBreakdownEntries(entries = {}) {
  return Object.entries(entries)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

export default function AdminPanel({
  users,
  analytics,
  auditLogs,
  costMetrics,
  currentUsername,
  isLoading,
  onRefreshUsers,
  onSetUserRole,
  onGenerateResetToken,
  onLoadAuditLogs,
  onLoadCostMetrics,
}) {
  const [activeTab, setActiveTab] = useState("users");
  const [feedback, setFeedback] = useState({ type: "info", text: "" });
  const [expireMinutesByUser, setExpireMinutesByUser] = useState({});
  const [resetTokens, setResetTokens] = useState({});
  const [auditFilter, setAuditFilter] = useState({ actor_username: "", action: "", resource_type: "" });
  const safeUsers = Array.isArray(users) ? users : [];
  const summary = analytics?.summary || null;
  const recentEvents = Array.isArray(analytics?.recent_events) ? analytics.recent_events : [];
  const answerPolicyEntries = renderBreakdownEntries(summary?.answer_policy_counts || {});
  const evidenceEntries = renderBreakdownEntries(summary?.evidence_strength_counts || {});
  const fallbackEntries = renderBreakdownEntries(summary?.fallback_reason_counts || {});
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeUserBreakdown = Array.isArray(costMetrics?.user_breakdown) ? costMetrics.user_breakdown : [];

  const setResult = (result, fallbackMessage) => {
    if (!result) return;
    setFeedback({
      type: result.success ? "success" : "error",
      text: result.message || fallbackMessage,
    });
  };

  const handleRoleUpdate = async (username, role) => {
    const result = await onSetUserRole(username, role);
    setResult(result, `Đã cập nhật role cho ${username}.`);
  };

  const handleGenerateResetToken = async (username) => {
    const expireMinutes = Number(expireMinutesByUser[username] || 30);
    const result = await onGenerateResetToken(username, expireMinutes);
    if (result?.success && result.reset_token) {
      setResetTokens((prev) => ({ ...prev, [username]: result.reset_token }));
    }
    setResult(result, `Đã tạo reset token cho ${username}.`);
  };

  const handleLoadAuditLogs = () => {
    if (onLoadAuditLogs) {
      onLoadAuditLogs({
        actor_username: auditFilter.actor_username || undefined,
        action: auditFilter.action || undefined,
        resource_type: auditFilter.resource_type || undefined,
      });
    }
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Admin console</h2>
          <p className={styles.subtitle}>
            Quản lý users, RAG observability, audit trail và cost metrics.
          </p>
        </div>
        <button className={styles.secondaryBtn} type="button" onClick={onRefreshUsers} disabled={isLoading}>
          Làm mới users
        </button>
      </header>

      {feedback.text ? (
        <div className={`${styles.feedback} ${feedback.type === "error" ? styles.error : styles.success}`}>
          {feedback.text}
        </div>
      ) : null}

      {/* Tab navigation */}
      <div className={styles.tabBar}>
        {[
          { id: "users", label: "Users" },
          { id: "analytics", label: "RAG Analytics" },
          { id: "cost", label: "Cost / Usage" },
          { id: "audit", label: "Audit Logs" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "cost" && onLoadCostMetrics && !costMetrics) onLoadCostMetrics();
              if (tab.id === "audit" && onLoadAuditLogs && safeAuditLogs.length === 0) handleLoadAuditLogs();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Users ── */}
      {activeTab === "users" && (
        <div className={styles.userGrid}>
          {safeUsers.length === 0 ? (
            <div className={styles.emptyState}>Chưa có user nào hoặc bạn không có quyền admin.</div>
          ) : (
            safeUsers.map((user) => {
              const isSelf = user.username === currentUsername;
              const currentExpire = expireMinutesByUser[user.username] ?? 30;
              return (
                <article key={user.id} className={styles.userCard}>
                  <div className={styles.userHeader}>
                    <div>
                      <h3 className={styles.username}>{user.username}</h3>
                      <p className={styles.meta}>#{user.id} · created {formatDate(user.created_at)}</p>
                    </div>
                    <span className={`${styles.roleBadge} ${user.role === "admin" ? styles.roleAdmin : styles.roleUser}`}>
                      {user.role}
                    </span>
                  </div>
                  <div className={styles.metaGrid}>
                    <div><strong>Quota/day:</strong> {user.max_tokens_per_day}</div>
                    <div><strong>Current user:</strong> {isSelf ? "Yes" : "No"}</div>
                  </div>
                  <div className={styles.actionGroup}>
                    <button className={styles.primaryBtn} type="button" onClick={() => handleRoleUpdate(user.username, "user")} disabled={isLoading || user.role === "user"}>Set user</button>
                    <button className={styles.primaryBtn} type="button" onClick={() => handleRoleUpdate(user.username, "admin")} disabled={isLoading || user.role === "admin"}>Set admin</button>
                  </div>
                  <div className={styles.resetGroup}>
                    <label className={styles.label} htmlFor={`expire-${user.id}`}>Reset token TTL (minutes)</label>
                    <div className={styles.resetRow}>
                      <input id={`expire-${user.id}`} className={styles.input} type="number" min="5" max="1440" value={currentExpire} onChange={(e) => setExpireMinutesByUser((prev) => ({ ...prev, [user.username]: e.target.value }))} disabled={isLoading} />
                      <button className={styles.secondaryBtn} type="button" onClick={() => handleGenerateResetToken(user.username)} disabled={isLoading}>Tạo reset token</button>
                    </div>
                    {resetTokens[user.username] ? (
                      <div className={styles.tokenBox}>
                        <span className={styles.tokenLabel}>Reset token hiện tại</span>
                        <code className={styles.code}>{resetTokens[user.username]}</code>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: RAG Analytics ── */}
      {activeTab === "analytics" && (
        <section className={styles.analyticsSection}>
          {!summary ? (
            <div className={styles.emptyState}>Chưa có dữ liệu analytics RAG.</div>
          ) : (
            <>
              <div className={styles.rowHeader}>
                <h3 className={styles.sectionTitle}>RAG observability</h3>
                <span className={styles.mutedText}>recent limit {analytics?.recent_limit || 20}</span>
              </div>
              <div className={styles.analyticsGrid}>
                <article className={styles.analyticsCard}><strong>Total retrievals</strong><span>{summary.total_events}</span></article>
                <article className={styles.analyticsCard}><strong>Hit rate</strong><span>{formatPercent(summary.hit_rate)}</span></article>
                <article className={styles.analyticsCard}><strong>Grounded rate</strong><span>{formatPercent(summary.grounded_rate)}</span></article>
                <article className={styles.analyticsCard}><strong>Weak rate</strong><span>{formatPercent(summary.weak_rate)}</span></article>
                <article className={styles.analyticsCard}><strong>Fallback rate</strong><span>{formatPercent(summary.fallback_rate)}</span></article>
                <article className={styles.analyticsCard}><strong>Cautious rate</strong><span>{formatPercent(summary.cautious_rate)}</span></article>
                <article className={styles.analyticsCard}><strong>Avg latency</strong><span>{Number(summary.avg_latency_ms || 0).toFixed(1)} ms</span></article>
                <article className={styles.analyticsCard}><strong>Documents</strong><span>{summary.indexed_documents}/{summary.total_documents}</span></article>
                <article className={styles.analyticsCard}><strong>Total chunks</strong><span>{summary.total_chunks}</span></article>
              </div>
              <div className={styles.breakdownGrid}>
                {[["Answer policy mix", answerPolicyEntries, "policy"], ["Evidence strength", evidenceEntries, "evidence"], ["Fallback reasons", fallbackEntries, "fallback"]].map(([title, entries, key]) => (
                  <article key={key} className={styles.breakdownCard}>
                    <h4 className={styles.breakdownTitle}>{title}</h4>
                    <div className={styles.pillList}>
                      {entries.length === 0 ? <span className={styles.mutedText}>No data</span> : entries.map((e) => (
                        <span key={`${key}-${e.label}`} className={styles.breakdownPill}><strong>{e.label}</strong><em>{e.count}</em></span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <div className={styles.eventsList}>
                {recentEvents.length === 0 ? (
                  <div className={styles.emptyState}>Chưa có retrieval event nào.</div>
                ) : recentEvents.map((event) => (
                  <article key={`${event.retrieval_id}-${event.request_id || "x"}`} className={styles.eventCard}>
                    <div className={styles.userHeader}>
                      <div>
                        <h4 className={styles.username}>#{event.retrieval_id} · {event.username}</h4>
                        <p className={styles.meta}>{formatDate(event.created_at)} · session {event.session_id || "-"}</p>
                      </div>
                      <div className={styles.badgeStack}>
                        <span className={`${styles.roleBadge} ${event.answer_policy === "grounded" ? styles.roleAdmin : styles.roleUser}`}>{event.answer_policy || "unknown"}</span>
                        <span className={styles.secondaryBadge}>{event.evidence_strength || "none"}</span>
                      </div>
                    </div>
                    <div className={styles.metaGrid}>
                      <div><strong>Strategy:</strong> {event.strategy || "-"}</div>
                      <div><strong>Latency:</strong> {event.latency_ms ?? 0} ms</div>
                      <div><strong>Returned:</strong> {event.returned}/{event.top_k}</div>
                      <div><strong>Citations:</strong> {event.citations_count}</div>
                      <div><strong>Scope:</strong> {event.scoped ? `doc #${event.document_id}` : "global"}</div>
                      <div><strong>Fallback:</strong> {event.fallback_used ? event.fallback_reason || "yes" : "no"}</div>
                    </div>
                    <div className={styles.tokenBox}>
                      <span className={styles.tokenLabel}>Query</span>
                      <code className={styles.code}>{event.query_text}</code>
                      {event.rewritten_query && event.rewritten_query !== event.query_text ? (<><span className={styles.tokenLabel}>Rewritten</span><code className={styles.code}>{event.rewritten_query}</code></>) : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── TAB: Cost / Usage ── */}
      {activeTab === "cost" && (
        <section className={styles.analyticsSection}>
          <div className={styles.rowHeader}>
            <h3 className={styles.sectionTitle}>Cost &amp; token usage</h3>
            <button className={styles.secondaryBtn} type="button" onClick={() => onLoadCostMetrics && onLoadCostMetrics()} disabled={isLoading}>Làm mới</button>
          </div>
          {!costMetrics ? (
            <div className={styles.emptyState}>Nhấn "Làm mới" để tải dữ liệu cost.</div>
          ) : (
            <>
              <div className={styles.analyticsGrid}>
                <article className={styles.analyticsCard}><strong>Total tokens</strong><span>{costMetrics.total_tokens?.toLocaleString()}</span></article>
                <article className={styles.analyticsCard}><strong>Input tokens</strong><span>{costMetrics.total_input_tokens?.toLocaleString()}</span></article>
                <article className={styles.analyticsCard}><strong>Output tokens</strong><span>{costMetrics.total_output_tokens?.toLocaleString()}</span></article>
                <article className={styles.analyticsCard}><strong>Retrieval events</strong><span>{costMetrics.total_retrieval_events}</span></article>
                <article className={styles.analyticsCard}><strong>Avg retrieval latency</strong><span>{Number(costMetrics.avg_retrieval_latency_ms || 0).toFixed(1)} ms</span></article>
                <article className={styles.analyticsCard}><strong>Min / Max latency</strong><span>{costMetrics.min_retrieval_latency_ms ?? "-"} / {costMetrics.max_retrieval_latency_ms ?? "-"} ms</span></article>
              </div>
              <h4 className={styles.breakdownTitle} style={{ marginTop: "1rem" }}>Per-user breakdown</h4>
              <div className={styles.userGrid}>
                {safeUserBreakdown.map((u) => (
                  <article key={u.username} className={styles.userCard}>
                    <div className={styles.userHeader}>
                      <h3 className={styles.username}>{u.username}</h3>
                    </div>
                    <div className={styles.metaGrid}>
                      <div><strong>Total:</strong> {u.total_tokens?.toLocaleString()}</div>
                      <div><strong>Input:</strong> {u.input_tokens?.toLocaleString()}</div>
                      <div><strong>Output:</strong> {u.output_tokens?.toLocaleString()}</div>
                      <div><strong>Daily quota:</strong> {u.max_tokens_per_day?.toLocaleString()}</div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── TAB: Audit Logs ── */}
      {activeTab === "audit" && (
        <section className={styles.analyticsSection}>
          <div className={styles.rowHeader}>
            <h3 className={styles.sectionTitle}>Audit trail</h3>
            <button className={styles.secondaryBtn} type="button" onClick={handleLoadAuditLogs} disabled={isLoading}>Tải / làm mới</button>
          </div>
          <div className={styles.analyticsGrid} style={{ marginBottom: "0.75rem" }}>
            <input className={styles.input} placeholder="Actor username" value={auditFilter.actor_username} onChange={(e) => setAuditFilter((p) => ({ ...p, actor_username: e.target.value }))} />
            <input className={styles.input} placeholder="Action (vd: document.upload)" value={auditFilter.action} onChange={(e) => setAuditFilter((p) => ({ ...p, action: e.target.value }))} />
            <input className={styles.input} placeholder="Resource type (vd: document)" value={auditFilter.resource_type} onChange={(e) => setAuditFilter((p) => ({ ...p, resource_type: e.target.value }))} />
          </div>
          {safeAuditLogs.length === 0 ? (
            <div className={styles.emptyState}>Chưa có audit log nào. Nhấn "Tải / làm mới".</div>
          ) : (
            <div className={styles.eventsList}>
              {safeAuditLogs.map((log) => (
                <article key={log.id} className={styles.eventCard}>
                  <div className={styles.userHeader}>
                    <div>
                      <h4 className={styles.username}>{log.action}</h4>
                      <p className={styles.meta}>{formatDate(log.created_at)} · actor: <strong>{log.actor_username}</strong></p>
                    </div>
                    <span className={styles.secondaryBadge}>{log.resource_type || "-"} #{log.resource_id || "-"}</span>
                  </div>
                  {log.detail_json ? (
                    <div className={styles.tokenBox}>
                      <span className={styles.tokenLabel}>Detail</span>
                      <code className={styles.code}>{JSON.stringify(log.detail_json)}</code>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
