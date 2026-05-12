# Dominic

Frontend workspace cho ứng dụng chat Dominic.

## Trạng thái hiện tại (verified 2026-05-12)

- React + Vite UI cho login/register, chat sessions và chat window markdown
- bearer token auth với backend `DominicBE`, tự lưu phiên đăng nhập ở browser
- assistant message hiển thị `assistant_meta.display_text` và expandable sources list; `retrieval` và message-level `usage` được lưu trên message nhưng không render trong transcript
- knowledge UI có search, reindex, delete, xem document chunks và ingestion jobs
- knowledge có thể import trực tiếp từ ô chat bằng upload file hoặc ingest text (E2E coverage locked — QA-001-K1/K2 ✅)
- knowledge documents được nhóm theo chat session hoặc global document nếu backend trả `session_id`
- standalone knowledge search là owner-wide (không gửi `session_id`); chat-triggered retrieval là session-aware với session→global fallback (QA-001-K4 ✅)
- user delete là soft-delete — document bị ẩn khỏi list nhưng không bị xóa cứng khỏi DB (QA-001-K3 ✅)
- admin UI đã có surface cho users, analytics, audit logs và cost metrics; admin endpoints tách biệt khỏi end-user knowledge features (INT-004 ✅)
- admin panel là presentation-only component — không import service module, nhận data và callbacks qua props (FE-005 ✅)
- deployment: static SPA qua Docker + nginx; `VITE_API_BASE_URL` và `VITE_API_TIMEOUT_MS` được bake vào bundle lúc build — thay đổi cần rebuild (OPS-001 ✅)
- `npm run build` pass trên workspace hiện tại
- `npm run lint` hiện fail (14 lỗi; lỗi đầu tiên là biến `activeSessionId` chưa dùng trong `chatbot-ui/src/components/ChatInput/ChatInput.jsx`)

## Hiện trạng phase theo chức năng

- Phase 1: auth UI, login/register, giữ phiên đăng nhập
- Phase 2: knowledge panel, search knowledge, xem chunks/jobs, reindex/delete
- Phase 3: render grounded chat metadata từ backend — transcript hiện render `assistant_meta.display_text` và expandable `sources`; `retrieval` và message-level `usage` được lưu nhưng không render trong transcript
- Phase 4: import knowledge theo từng chat session ngay từ `ChatInput` — upload file và ingest text đều có E2E coverage
- Phase admin: quản lý users và đọc analytics/audit/cost metrics; admin-only endpoints tách biệt khỏi end-user knowledge features

## Chạy nhanh

```bash
cd chatbot-ui
npm install
npm run dev
```

## Kiểm tra nhanh

```bash
cd chatbot-ui
npm run build
npm run lint
```

## Backend tương ứng

Frontend này dùng backend trong repo `DominicBE`. Namespace chính thức (canonical) của tất cả API là `/api/v1`:

```text
/api/v1/auth/*
/api/v1/chat/*
/api/v1/knowledge/*
```

Backend cũng giữ alias `/api/*` để tương thích ngược, nhưng frontend chỉ dùng `/api/v1` (xem [`API_PREFIX`](chatbot-ui/src/service/apiClient.js:6)).

### Auth logout behavior

- `/api/v1/auth/logout` yêu cầu bearer token hợp lệ (bearer-only).
- Nếu access token đã hết hạn tại thời điểm logout, backend trả 401 — **không** revoke session vì request không được xác thực.
- Frontend xử lý edge case này bằng cách refresh token đúng 1 lần rồi retry logout đúng 1 lần (trong [`handleLogout()`](chatbot-ui/src/App.jsx:925)).
- Local auth state **luôn được clear trong `finally`**, kể cả khi server call thất bại hoàn toàn — local clear là fallback cuối cùng, không phải bằng chứng server revoke thành công trong mọi path.

## Lưu ý

- UI đã build được nhưng hiện chưa sạch lint.
- Playwright E2E smoke coverage đã có, bao gồm session recovery và logout edge behavior (xem [`chatbot-ui/tests/e2e/`](chatbot-ui/tests/e2e)).
