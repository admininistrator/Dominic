# Dominic Chatbot UI

Frontend React + Vite cho dự án Dominic.

## Phase 1 hiện tại

- đăng ký tài khoản
- đăng nhập bằng username/password
- lưu bearer token trong `localStorage`
- tự khôi phục phiên đăng nhập khi reload trang
- gọi backend auth qua `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- gọi chat qua `/api/chat/*`
- có thể bật Tavily web search theo từng câu hỏi ngay trong ô chat khi backend đã điền `TAVILY_API_KEY`

## Phase 2 hiện tại

- upload tài liệu qua `/api/knowledge/upload`
- ingest raw text qua `/api/knowledge/ingest`
- xem danh sách documents/chunks/jobs
- search knowledge chunks đã index qua `/api/knowledge/search`
- reindex và xóa document từ UI

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

## Kiểm tra chất lượng

```bash
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e -- tests/e2e
```

Playwright smoke hiện mock API trực tiếp ở browser layer, nên có thể kiểm tra các luồng quan trọng mà không cần backend thật:

- helper facade giữ ở `tests/e2e/support/mockApi.js`, còn route handlers được tách theo domain trong `tests/e2e/support/mockApi/`

- đăng nhập
- đăng ký
- quên mật khẩu
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
- knowledge search 0 kết quả
- knowledge search lỗi backend
- ưu tiên global document khi không có session document
- knowledge reindex lỗi backend
- knowledge delete lỗi backend
- knowledge search / reindex / delete

## Ghi chú auth

- token hiện được lưu ở browser `localStorage`
- khi backend đổi `AUTH_SECRET_KEY`, người dùng sẽ phải đăng nhập lại
- khi frontend chạy khác domain với backend, cần cấu hình đúng `VITE_API_BASE_URL` và `CORS_ORIGINS` phía backend

## Ghi chú knowledge base

- upload file dùng `multipart/form-data` với field tên `file`
- backend hiện có local indexing MVP: chunking + embedding metadata cục bộ + search trong DB
- Phase 2 hiện chưa nối retrieval vào câu trả lời chat; knowledge search đang hoạt động độc lập ở Knowledge panel

