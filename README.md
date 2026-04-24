# Dominic

Frontend workspace cho ứng dụng chat Dominic.

## Hiện trạng Phase 1

- React + Vite UI
- login/register UI hoàn chỉnh
- bearer token auth với backend `DominicBE`
- tự lưu phiên đăng nhập ở browser

## Hiện trạng Phase 2

- knowledge panel cho upload / ingest text / reindex / delete
- xem document chunks và ingestion jobs
- search knowledge chunks đã index từ UI

## Chạy nhanh

```bash
cd chatbot-ui
npm install
npm run dev
```

## Backend tương ứng

Frontend này dùng backend trong repo `DominicBE` với các endpoint auth/chat dưới prefix:

```text
/api/auth
/api/chat
/api/knowledge
```
