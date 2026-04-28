# Dominic

Frontend workspace cho ứng dụng chat Dominic.

## Trạng thái hiện tại (verified 2026-04-25)

- React + Vite UI cho login/register, chat sessions và chat window markdown
- bearer token auth với backend `DominicBE`, tự lưu phiên đăng nhập ở browser
- assistant message có retrieval badge, usage metadata và expandable sources list
- knowledge UI có search, reindex, delete, xem document chunks và ingestion jobs
- knowledge có thể import trực tiếp từ ô chat bằng upload file hoặc ingest text
- knowledge documents được nhóm theo chat session hoặc global document nếu backend trả `session_id`
- admin UI đã có surface cho users, analytics, audit logs và cost metrics
- `npm run build` pass trên workspace hiện tại
- `npm run lint` hiện fail (14 lỗi; lỗi đầu tiên là biến `activeSessionId` chưa dùng trong `chatbot-ui/src/components/ChatInput/ChatInput.jsx`)

## Hiện trạng phase theo chức năng

- Phase 1: auth UI, login/register, giữ phiên đăng nhập
- Phase 2: knowledge panel, search knowledge, xem chunks/jobs, reindex/delete
- Phase 3: render grounded chat metadata từ backend (`sources`, `retrieval`, answer policy)
- Phase 4: import knowledge theo từng chat session ngay từ `ChatInput`
- Phase admin: quản lý users và đọc analytics/audit/cost metrics

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

Frontend này dùng backend trong repo `DominicBE` với các endpoint auth/chat dưới prefix:

```text
/api/auth
/api/chat
/api/knowledge
```

## Lưu ý

- UI đã build được nhưng hiện chưa sạch lint.
- Repo hiện chưa có browser E2E test để xác nhận luồng UI end-to-end.
