import os
from uuid import uuid4

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.core.config import (
    CONTEXT_WINDOW_SIZE,
    MAX_OUTPUT_TOKENS,
    ROLLING_WINDOW_HOURS,
    SUMMARY_MAX_TOKENS,
    SUMMARY_TRIGGER_MESSAGES,
    TOKEN_ESTIMATE_CHARS_PER_TOKEN,
)
from app.crud import crud_chat

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL_NAME = os.getenv("ANTHROPIC_MODEL")

def login_user(db: Session, username: str, password: str):
    user = crud_chat.verify_user_credentials(db, username, password)
    if not user:
        raise ValueError("Invalid username or password.")
    return {"success": True, "username": user.username}


def get_usage(db: Session, username: str):
    user = crud_chat.get_user_by_username(db, username)
    if not user:
        raise ValueError(f"User '{username}' not found.")
    usage = crud_chat.get_user_usage(db, username)
    rolling = crud_chat.get_rolling_token_usage(db, username, window_hours=ROLLING_WINDOW_HOURS)
    return {
        "username": usage["username"],
        "max_tokens_per_day": usage["max_tokens_per_day"],
        # Compatibility keys now explicitly represent rolling window.
        "total_token_used": rolling["total_tokens"],
        "total_input_tokens_used": rolling["input_tokens"],
        "total_output_tokens_used": rolling["output_tokens"],
        # Explicit lifetime counters from users table.
        "lifetime_total_token_used": usage["total_token_used"],
        "lifetime_total_input_tokens_used": usage["total_input_tokens_used"],
        "lifetime_total_output_tokens_used": usage["total_output_tokens_used"],
        # Explicit rolling counters used for quota enforcement.
        "rolling_window_hours": ROLLING_WINDOW_HOURS,
        "rolling_total_token_used": rolling["total_tokens"],
        "rolling_input_tokens_used": rolling["input_tokens"],
        "rolling_output_tokens_used": rolling["output_tokens"],
    }


def create_session(db: Session, username: str, title: str | None = None):
    user = crud_chat.get_user_by_username(db, username)
    if not user:
        raise ValueError(f"User '{username}' not found.")
    row = crud_chat.create_chat_session(db, username, title)
    return {
        "id": row.id,
        "username": row.username,
        "title": row.title,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def get_sessions(db: Session, username: str):
    user = crud_chat.get_user_by_username(db, username)
    if not user:
        raise ValueError(f"User '{username}' not found.")
    rows = crud_chat.list_chat_sessions(db, username)
    return [
        {
            "id": r.id,
            "username": r.username,
            "title": r.title,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]


def get_session_history(db: Session, username: str, session_id: int):
    session = crud_chat.get_chat_session(db, username, session_id)
    if not session:
        raise ValueError("Session not found.")
    rows = crud_chat.get_session_messages(db, username, session_id)
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "input_tokens": int(m.input_tokens or 0),
            "output_tokens": int(m.output_tokens or 0),
            "created_at": m.created_at,
        }
        for m in rows
    ]


def _estimate_input_tokens(messages: list[dict], system_prompt: str | None = None) -> int:
    # Prefer provider-side token counting when available.
    try:
        token_info = client.messages.count_tokens(
            model=MODEL_NAME,
            messages=messages,
            system=system_prompt or "",
        )
        return int(getattr(token_info, "input_tokens", 0) or 0)
    except Exception:
        # Fallback heuristic: ~4 chars/token for mixed VN/EN text.
        total_chars = sum(len((m.get("content") or "")) for m in messages)
        if system_prompt:
            total_chars += len(system_prompt)
        return max(1, total_chars // TOKEN_ESTIMATE_CHARS_PER_TOKEN)


def _build_summary_prompt(old_summary: str, messages: list) -> str:
    transcript = "\n".join([f"[{m.role}] {m.content}" for m in messages])
    return (
        "You are a memory compressor for chat context. "
        "Create a concise factual summary that preserves user preferences, goals, constraints, and unresolved tasks. "
        "Do not include fluff.\n\n"
        f"Previous summary:\n{old_summary or '(none)'}\n\n"
        f"New transcript chunk:\n{transcript}\n\n"
        "Return updated summary only."
    )


def _refresh_summary_if_needed(db: Session, username: str, session_id: int):
    summary_row = crud_chat.get_chat_summary(db, username, session_id)
    last_done_id = int(summary_row.last_summarized_message_id or 0) if summary_row else 0

    recent = crud_chat.get_recent_user_history(db, username, session_id, CONTEXT_WINDOW_SIZE)
    if not recent:
        return summary_row

    recent_first_id = recent[0].id
    candidates = crud_chat.get_messages_for_summary(
        db=db,
        username=username,
        session_id=session_id,
        after_id=last_done_id,
        before_id=recent_first_id,
    )

    if len(candidates) < SUMMARY_TRIGGER_MESSAGES:
        return summary_row

    try:
        prompt = _build_summary_prompt(summary_row.summary_text if summary_row else "", candidates)
        resp = client.messages.create(
            model=MODEL_NAME,
            max_tokens=SUMMARY_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        updated_summary = resp.content[0].text.strip()
        return crud_chat.upsert_chat_summary(
            db=db,
            username=username,
            session_id=session_id,
            summary_text=updated_summary,
            last_message_id=candidates[-1].id,
        )
    except Exception:
        # If summarization fails, continue with recent window only.
        return summary_row


def _build_hybrid_context(db: Session, username: str, session_id: int):
    summary_row = _refresh_summary_if_needed(db, username, session_id)
    recent = crud_chat.get_recent_user_history(db, username, session_id, CONTEXT_WINDOW_SIZE)
    formatted_messages = [{"role": m.role, "content": m.content} for m in recent]

    system_prompt = None
    if summary_row and summary_row.summary_text:
        system_prompt = (
            "Conversation memory summary (may omit small details). "
            "Use this as background context:\n" + summary_row.summary_text
        )
    return system_prompt, formatted_messages


def handle_chat(db: Session, username: str, session_id: int, user_message: str):
    user = crud_chat.get_user_by_username(db, username)
    if not user:
        raise ValueError(f"User '{username}' not found.")
    session = crud_chat.get_chat_session(db, username, session_id)
    if not session:
        raise ValueError("Session not found.")

    daily_limit = int(user.max_tokens_per_day or 10000)
    rolling = crud_chat.get_rolling_token_usage(db, username, window_hours=ROLLING_WINDOW_HOURS)
    total_used = int(rolling["total_tokens"])
    remaining_tokens = daily_limit - total_used
    if remaining_tokens <= 0:
        raise PermissionError(
            f"Rolling {ROLLING_WINDOW_HOURS}-hour token limit exceeded ({total_used}/{daily_limit})."
        )

    request_id = str(uuid4())

    user_msg = crud_chat.create_message(
        db=db,
        role="user",
        sender_username=username,
        session_id=session_id,
        content=user_message,
        request_id=request_id,
        status="pending",
    )

    try:
        system_prompt, formatted_messages = _build_hybrid_context(db, username, session_id)

        estimated_input_tokens = _estimate_input_tokens(formatted_messages, system_prompt)
        if estimated_input_tokens >= remaining_tokens:
            crud_chat.update_message_tokens_and_status(
                db=db,
                message_id=user_msg.id,
                status="error",
                error_message="Rolling 2-hour token limit exceeded before API call.",
            )
            raise PermissionError("Rolling 2-hour token limit exceeded.")

        max_output_tokens = min(MAX_OUTPUT_TOKENS, remaining_tokens - estimated_input_tokens)
        if max_output_tokens <= 0:
            crud_chat.update_message_tokens_and_status(
                db=db,
                message_id=user_msg.id,
                status="error",
                error_message="No remaining output token budget.",
            )
            raise PermissionError("Rolling 2-hour token limit exceeded.")

        request_kwargs = {
            "model": MODEL_NAME,
            "max_tokens": max_output_tokens,
            "messages": formatted_messages,
        }
        if system_prompt:
            request_kwargs["system"] = system_prompt
        response = client.messages.create(**request_kwargs)

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
            session_id=session_id,
            content=ai_content,
            request_id=request_id,
            input_tokens=0,
            output_tokens=out_tokens,
            status="success",
        )

        crud_chat.touch_chat_session(db, session_id)

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
