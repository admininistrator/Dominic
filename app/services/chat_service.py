import os
from uuid import uuid4

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.crud import crud_chat

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL_NAME = os.getenv("ANTHROPIC_MODEL")


def login_user(db: Session, username: str, password: str):
    user = crud_chat.verify_user_credentials(db, username, password)
    if not user:
        raise ValueError("Invalid username or password.")
    return {"success": True, "username": user.username}


def get_usage(db: Session, username: str):
    usage = crud_chat.get_user_usage(db, username)
    if not usage:
        raise ValueError(f"User '{username}' not found.")
    return usage


def _estimate_input_tokens(messages: list[dict]) -> int:
    # Prefer provider-side token counting when available.
    try:
        token_info = client.messages.count_tokens(
            model=MODEL_NAME,
            messages=messages,
        )
        return int(getattr(token_info, "input_tokens", 0) or 0)
    except Exception:
        # Fallback heuristic: ~4 chars/token for mixed VN/EN text.
        total_chars = sum(len((m.get("content") or "")) for m in messages)
        return max(1, total_chars // 4)


def handle_chat(db: Session, username: str, user_message: str):
    user = crud_chat.get_user_by_username(db, username)
    if not user:
        raise ValueError(f"User '{username}' not found.")

    daily_limit = int(user.max_tokens_per_day or 10000)
    total_used = int(user.total_token_used or 0)
    remaining_tokens = daily_limit - total_used
    if remaining_tokens <= 0:
        raise PermissionError("Daily token limit exceeded.")

    request_id = str(uuid4())

    user_msg = crud_chat.create_message(
        db=db,
        role="user",
        sender_username=username,
        content=user_message,
        request_id=request_id,
        status="pending",
    )

    try:
        history = crud_chat.get_user_history(db, username)
        formatted_messages = [{"role": msg.role, "content": msg.content} for msg in history]

        estimated_input_tokens = _estimate_input_tokens(formatted_messages)
        if estimated_input_tokens >= remaining_tokens:
            crud_chat.update_message_tokens_and_status(
                db=db,
                message_id=user_msg.id,
                status="error",
                error_message="Daily token limit exceeded before API call.",
            )
            raise PermissionError("Daily token limit exceeded.")

        max_output_tokens = min(1024, remaining_tokens - estimated_input_tokens)
        if max_output_tokens <= 0:
            crud_chat.update_message_tokens_and_status(
                db=db,
                message_id=user_msg.id,
                status="error",
                error_message="No remaining output token budget.",
            )
            raise PermissionError("Daily token limit exceeded.")

        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=max_output_tokens,
            messages=formatted_messages,
        )

        ai_content = response.content[0].text
        in_tokens = int(response.usage.input_tokens or 0)
        out_tokens = int(response.usage.output_tokens or 0)

        crud_chat.update_message_tokens_and_status(
            db=db,
            message_id=user_msg.id,
            input_tokens=in_tokens,
            status="success",
            error_message=None,
        )

        crud_chat.create_message(
            db=db,
            role="assistant",
            sender_username=username,
            content=ai_content,
            request_id=request_id,
            input_tokens=0,
            output_tokens=out_tokens,
            status="success",
        )

        crud_chat.increment_user_tokens(db, username, in_tokens, out_tokens)

        return {
            "reply": ai_content,
            "usage": {"input_tokens": in_tokens, "output_tokens": out_tokens},
            "request_id": request_id,
        }

    except Exception as e:
        crud_chat.update_message_tokens_and_status(
            db=db,
            message_id=user_msg.id,
            status="error",
            error_message=str(e),
        )
        raise
