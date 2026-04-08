from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    max_tokens_per_day = Column(Integer, default=10000)
    total_token_used = Column(Integer, default=0)
    total_input_tokens_used = Column(Integer, default=0)
    total_output_tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    last_message_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class ConversationMember(Base):
    __tablename__ = "conversation_members"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime, server_default=func.now())

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(String(36), nullable=False, index=True)
    sender_username = Column(String(255), nullable=False, index=True)
    role = Column(Enum("user", "assistant"), nullable=False)
    content = Column(Text, nullable=False)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    status = Column(Enum("pending", "success", "error"), nullable=False, server_default="pending")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
