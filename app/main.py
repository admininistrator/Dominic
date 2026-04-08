from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import chat
from app.core.database import engine, Base

# Tạo các bảng trong DB nếu chưa có
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chatbot AI Backend")

# Cấu hình CORS để Next.js/React có thể gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Trong production nên đổi thành domain cụ thể của frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký Router
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

# Khởi chạy bằng lệnh: uvicorn app.main:app --reload