# Dominic Chatbot UI

Frontend React + Vite cho dự án Dominic.

## Phase 1 hiện tại

- đăng ký tài khoản
- đăng nhập bằng username/password
- lưu bearer token và refresh token trong `localStorage`
- tự khôi phục phiên đăng nhập khi reload trang (bootstrap session recovery qua `/api/v1/auth/me`)
- gọi backend auth qua `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`
- gọi chat qua `/api/v1/chat/*`
- có thể bật Tavily web search theo từng câu hỏi ngay trong ô chat khi backend đã điền `TAVILY_API_KEY`

## Phase 2 hiện tại

- upload tài liệu qua `/api/v1/knowledge/documents/upload`
- ingest raw text qua `/api/v1/knowledge/documents/ingest`
- xem danh sách documents/chunks/jobs
- search knowledge chunks đã index qua `/api/v1/knowledge/search`
- reindex và xóa document từ UI
- retrieval context từ knowledge base được nối vào chat answers; transcript hiện render `assistant_meta.display_text` và expandable sources; `retrieval` và message-level `usage` được lưu trên assistant messages nhưng không hiển thị trong transcript

## Chạy local

```bash
npm install
npm run dev
```

Mặc định frontend gọi backend ở:

```text
http://127.0.0.1:8000
```

## Environment

Sao chép từ `.env.example` và chỉnh nếu cần:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_TIMEOUT_MS=120000
```

## Docker / AWS deployment

### Đã làm được

- frontend đã có `Dockerfile` multi-stage để build bằng Node và serve bằng Nginx
- có `nginx.conf` để hỗ trợ SPA fallback và health endpoint `/healthz`
- backend repo đã có `deploy/docker-compose.ec2.yml` để build frontend này cùng backend trên EC2

### Build-time vs runtime configuration (OPS-001 ✅)

- `VITE_API_BASE_URL` và `VITE_API_TIMEOUT_MS` là **build-time values** — Vite bake chúng vào bundle lúc `npm run build`. Thay đổi giá trị này **bắt buộc phải rebuild và redeploy** image.
- Dockerfile nhận `VITE_API_BASE_URL` và `VITE_API_TIMEOUT_MS` qua Docker `ARG` (default: `https://api.dominicapp.dev` và `120000`).
- nginx.conf không có backend proxy — frontend chỉ serve static files; toàn bộ API traffic đi thẳng từ browser đến backend tại `VITE_API_BASE_URL`. CORS phải được cấu hình phía backend.
- Health check: `GET /healthz` trả `200 ok` (dùng cho Docker health check và load balancer probe).
- **Lưu ý:** để `VITE_API_BASE_URL` trống (same-host mode) **không được hỗ trợ** bởi `resolveBaseUrl()` hiện tại — phải set URL tường minh.

### Chưa tự làm thay frontend được

- frontend image chỉ build static assets; reverse proxy TLS/domain vẫn nên đặt ở Nginx host trên EC2
- `VITE_API_BASE_URL` vẫn là giá trị build-time, đổi xong phải rebuild image frontend

### Cần làm tiếp khi deploy AWS

- đọc guide `../../DominicBE/DEPLOY_AWS_EC2_DOCKER.md`
- bảo đảm frontend repo được clone thành sibling của backend repo trên EC2
- truyền `FRONTEND_VITE_API_BASE_URL=https://api.dominicapp.dev` qua file `.env.ec2` ở backend repo trước khi chạy compose

## Kiểm tra chất lượng

```bash
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e -- tests/e2e
```

Playwright smoke hiện mock API trực tiếp ở browser layer, nên có thể kiểm tra các luồng quan trọng mà không cần backend thật:

- helper facade giữ ở `tests/e2e/support/mockApi.js`, còn route handlers được tách theo domain trong `tests/e2e/support/mockApi/`

**Auth flows:**
- đăng nhập
- đăng ký
- quên mật khẩu / reset password
- bootstrap session recovery với valid stored token (bypass login)
- bootstrap session recovery với stale access token + valid refresh token (refresh → replay)
- bootstrap fallback về login khi cả access token và refresh token đều expired
- normal logout (1 lần call, quay về login screen)
- logout với stale access token + valid refresh → refresh 1 lần, retry logout 1 lần
- logout với stale access token + invalid refresh → không retry loop, local state vẫn cleared

**Chat flows:**
- tìm hội thoại trong sidebar
- tạo chat mới
- chuyển session chat
- đổi tên / xóa session chat
- đổi tên session bằng blur
- xóa session cuối và fallback về Chat 1
- ingest text trực tiếp theo session
- upload nhiều loại tài liệu (.md / .pdf / .docx)
- upload tài liệu lỗi và feedback inline
- ingest text lỗi và feedback inline
- grounded chat
- mở sources
- xác nhận logout

**Knowledge flows:**
- knowledge search 0 kết quả
- knowledge search lỗi backend
- ưu tiên global document khi không có session document
- knowledge reindex lỗi backend
- knowledge delete lỗi backend
- knowledge search / reindex / delete
- standalone knowledge search là owner-wide: không gửi `session_id`, `scope`, hay `document_id` (QA-001-K4 ✅)
- upload file từ ChatInput với `session_id` query param (QA-001-K1 ✅)
- ingest raw text từ ChatInput với `title`, `raw_text`, `session_id` trong body (QA-001-K2 ✅)
- user delete là soft-delete: document bị ẩn khỏi list sau DELETE 204 (QA-001-K3 ✅)

## Ghi chú admin

- Admin panel chỉ hiển thị khi `user.role === "admin"` — Sidebar ẩn nav button với non-admin users.
- Admin endpoints tách biệt thành hai nhóm: auth-domain (`/api/v1/auth/admin/*`) và knowledge-domain telemetry (`/api/v1/knowledge/admin/*`).
- `AdminPanel` là presentation-only component — không import service module; nhận data và callbacks qua props từ `App`.
- Admin E2E coverage chưa có (không có admin mock harness) — deferred gap, không phải blocker.

## Ghi chú auth

### Namespace API

- Canonical namespace là `/api/v1` — tất cả frontend service calls đều dùng prefix này (xem [`API_PREFIX`](src/service/apiClient.js:6)).
- Backend cũng giữ alias `/api/*` để tương thích ngược nhưng frontend không dùng path này.

### Token storage

- Access token và refresh token đều được lưu ở browser `localStorage` với keys `dominic.authToken` và `dominic.refreshToken`.
- Khi backend đổi `AUTH_SECRET_KEY`, người dùng sẽ phải đăng nhập lại.
- Khi frontend chạy khác domain với backend, cần cấu hình đúng `VITE_API_BASE_URL` và `CORS_ORIGINS` phía backend.

### Refresh token và retry

- Axios interceptor trong [`apiClient`](src/service/apiClient.js:148) tự động refresh token và replay request khi nhận 401 từ các endpoint không phải auth.
- Auth endpoints (login, register, refresh, logout) được loại trừ khỏi auto-retry để tránh retry loop.
- Streaming chat ([`sendChatMessageStream()`](src/service/chatApi.js)) có đường retry riêng vì dùng Fetch thay vì Axios.

### Logout behavior

- `/api/v1/auth/logout` yêu cầu bearer token hợp lệ (bearer-only).
- Backend trả 401 nếu access token đã hết hạn — request không được xác thực nên session không bị revoke phía server trong path này.
- Frontend xử lý edge case này trong [`handleLogout()`](src/App.jsx:925): nếu logout trả 401 và còn refresh token thì refresh đúng 1 lần rồi retry logout đúng 1 lần.
- Local auth state **luôn được clear trong `finally`** kể cả khi server call thất bại — local clear là fallback cuối cùng, không phải bằng chứng server revoke thành công trong mọi failure path.

## Ghi chú knowledge base

- upload file dùng `multipart/form-data` với field tên `file`
- backend có local indexing: chunking + embedding metadata + search trong DB
- retrieval context được nối vào chat answers; transcript hiện render `assistant_meta.display_text` và expandable sources; `retrieval` và message-level `usage` được lưu trên assistant messages nhưng không hiển thị trong transcript

