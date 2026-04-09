from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ChatRequest(BaseModel):
    username: str
    session_id: int
    message: str

class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int

class ChatResponse(BaseModel):
    success: bool
    reply: str
    usage: TokenUsage
    request_id: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    username: str


class UsageResponse(BaseModel):
    username: str
    max_tokens_per_day: int
    total_token_used: int
    total_input_tokens_used: int
    total_output_tokens_used: int
    lifetime_total_token_used: int
    lifetime_total_input_tokens_used: int
    lifetime_total_output_tokens_used: int
    rolling_window_hours: int
    rolling_total_token_used: int
    rolling_input_tokens_used: int
    rolling_output_tokens_used: int


class SessionCreateRequest(BaseModel):
    username: str
    title: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    username: str
    title: str
    created_at: datetime
    updated_at: datetime


class SessionMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    input_tokens: int
    output_tokens: int
    created_at: datetime


