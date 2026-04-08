from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    username: str
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

