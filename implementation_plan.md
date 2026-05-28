# Tích hợp Dynamic Theming với `DESIGN.md` cho Dominic Chatbot

Mục tiêu của kế hoạch này là chuyển đổi giao diện ứng dụng Dominic sang thiết kế mới từ dự án Stitch ("Markdown Design System"), đồng thời giữ lại phong cách cũ dưới dạng một file cấu hình. Chúng ta sẽ thêm chức năng parse file `DESIGN.md` để tự động cập nhật các biến CSS (CSS Variables) ở cấp độ `:root`, giúp thay đổi UI linh hoạt mà không cần code lại.

## User Review Required
- Chúng ta sẽ cài đặt thư viện `js-yaml` để parse frontmatter trong file `DESIGN.md`. 
- Cần map các màu sắc từ `DESIGN.md` của Stitch vào các biến CSS hiện tại của hệ thống (ví dụ `--bg`, `--primary`, `--panel`) để không phá vỡ logic CSS hiện có, thay vì đổi toàn bộ class CSS trong component. Bạn có đồng ý với hướng tiếp cận này không?

## Proposed Changes

### 1. Cài đặt dependency
Chạy lệnh `npm install js-yaml` trong thư mục `C:\Users\Admin\Documents\DominicChatbot\Dominic\chatbot-ui` để parse YAML metadata từ file DESIGN.

---

### 2. Tạo các tệp DESIGN.md mẫu trong `public/`
- **[NEW] `public/DESIGN-legacy.md`**: Đại diện cho phong cách UI hiện tại (Night/Dark theme với tone màu xanh dương, các biến từ `variables.css`).
- **[NEW] `public/DESIGN-modern.md`**: Giao diện mới lấy từ dự án Stitch (Editorial / Modern, sử dụng màu kem, cam san hô và navy).

---

### 3. Logic xử lý Theme (Theme Parser)
- **[NEW] `src/utils/themeParser.js`**: 
  - Đọc file Markdown, tách phần frontmatter (`--- yaml ---`).
  - Dùng `js-yaml` để parse thành Object JSON.
  - Chuyển đổi (map) các token (như `colors.background`, `colors.primary`) thành các biến CSS gốc của ứng dụng (`--bg`, `--primary`, `--text`, v.v.).
  - Inject trực tiếp các biến này vào `document.documentElement.style`.

---

### 4. Tích hợp giao diện thay đổi Theme
- **[MODIFY] `src/App.jsx`**: 
  - Khởi động mặc định với file `DESIGN-modern.md` (Giao diện mới).
  - Thêm một nút / tính năng nhỏ ở góc (hoặc trong AdminPanel) cho phép người dùng **Tải lên file `DESIGN.md`** hoặc **Chọn giữa Modern và Legacy**.

## Verification Plan

### Automated Tests
- Khởi chạy Vite dev server, truy cập ứng dụng để xem giao diện mặc định có được áp dụng thành công tông màu Editorial/Modern hay không.

### Manual Verification
- Thử upload một file `DESIGN.md` mới (hoặc chuyển đổi qua lại giữa Legacy và Modern) và xác nhận rằng toàn bộ UI (nền, nút bấm, chữ) thay đổi theo thời gian thực mà không cần tải lại trang.
