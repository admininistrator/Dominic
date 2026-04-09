from sqlalchemy.orm import Session
from app.models.chat_models import Message, User, ChatSummary, ChatSession
from uuid import uuid4
from datetime import datetime
from datetime import timedelta
from sqlalchemy import func

def create_message(
    db: Session,
    role: str,
    sender_username: str,
    session_id: int,
    content: str,
    request_id: str | None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    status: str = "pending",
    error_message: str | None = None,
):
    if not request_id:
        request_id = str(uuid4())
    db_message = Message(
        session_id=session_id,
        request_id=request_id,
        role=role,
        sender_username=sender_username,
        content=content,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        status=status,
        error_message=error_message,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


def get_user_history(db: Session, username: str):
    return (
        db.query(Message)
        .filter(Message.sender_username == username)
        .order_by(Message.created_at.asc())
        .all()
    )


def create_chat_session(db: Session, username: str, title: str | None = None):
    row = ChatSession(
        username=username,
        title=(title or "New chat").strip() or "New chat",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_chat_session(db: Session, username: str, session_id: int):
    return (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.username == username)
        .first()
    )


def list_chat_sessions(db: Session, username: str):
    return (
        db.query(ChatSession)
        .filter(ChatSession.username == username)
        .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        .all()
    )


def touch_chat_session(db: Session, session_id: int):
    row = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if row:
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
    return row


def get_session_messages(db: Session, username: str, session_id: int):
    return (
        db.query(Message)
        .filter(
            Message.sender_username == username,
            Message.session_id == session_id,
        )
        .order_by(Message.id.asc())
        .all()
    )


def get_recent_user_history(db: Session, username: str, session_id: int, limit: int):
    rows = (
        db.query(Message)
        .filter(
            Message.sender_username == username,
            Message.session_id == session_id,
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))


def get_messages_for_summary(db: Session, username: str, session_id: int, after_id: int, before_id: int):
    return (
        db.query(Message)
        .filter(
            Message.sender_username == username,
            Message.session_id == session_id,
            Message.id > after_id,
            Message.id < before_id,
        )
        .order_by(Message.id.asc())
        .all()
    )


def get_chat_summary(db: Session, username: str, session_id: int):
    return (
        db.query(ChatSummary)
        .filter(ChatSummary.username == username, ChatSummary.session_id == session_id)
        .first()
    )


def upsert_chat_summary(db: Session, username: str, session_id: int, summary_text: str, last_message_id: int):
    row = (
        db.query(ChatSummary)
        .filter(ChatSummary.username == username, ChatSummary.session_id == session_id)
        .first()
    )
    if not row:
        row = ChatSummary(
            username=username,
            session_id=session_id,
            summary_text=summary_text,
            last_summarized_message_id=last_message_id,
        )
        db.add(row)
    else:
        row.summary_text = summary_text
        row.last_summarized_message_id = last_message_id
    db.commit()
    db.refresh(row)
    return row


def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


def reset_user_tokens_if_needed(db: Session, user: User, reset_interval_hours: int = 2):
    now = datetime.utcnow()
    last_reset = user.last_token_reset_at or user.created_at or now
    if now - last_reset >= timedelta(hours=reset_interval_hours):
        user.total_token_used = 0
        user.total_input_tokens_used = 0
        user.total_output_tokens_used = 0
        user.last_token_reset_at = now
        db.commit()
        db.refresh(user)
    return user


def get_rolling_token_usage(db: Session, username: str, window_hours: int = 2):
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    totals = (
        db.query(
            func.coalesce(func.sum(Message.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(Message.output_tokens), 0).label("output_tokens"),
        )
        .filter(
            Message.sender_username == username,
            Message.created_at >= cutoff,
            Message.status == "success",
        )
        .first()
    )
    input_tokens = int(totals.input_tokens or 0)
    output_tokens = int(totals.output_tokens or 0)
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
    }


def verify_user_credentials(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    # Current project stores plaintext passwords; keep compatible for now.
    if user.password != password:
        return None
    return user


def get_user_usage(db: Session, username: str):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    return {
        "username": user.username,
        "max_tokens_per_day": int(user.max_tokens_per_day or 10000),
        "total_token_used": int(user.total_token_used or 0),
        "total_input_tokens_used": int(user.total_input_tokens_used or 0),
        "total_output_tokens_used": int(user.total_output_tokens_used or 0),
    }


def increment_user_tokens(db: Session, username: str, input_tokens: int, output_tokens: int):
    user = db.query(User).filter(User.username == username).first()
    if user:
        user = reset_user_tokens_if_needed(db, user, reset_interval_hours=2)
        if user.total_token_used is None:
            user.total_token_used = 0
        if getattr(user, 'total_input_tokens_used', None) is None:
            user.total_input_tokens_used = 0
        if getattr(user, 'total_output_tokens_used', None) is None:
            user.total_output_tokens_used = 0

        user.total_input_tokens_used += input_tokens
        user.total_output_tokens_used += output_tokens
        user.total_token_used += (input_tokens + output_tokens)
        db.commit()
        db.refresh(user)
    return user


def update_message_tokens(db: Session, message_id: int, input_tokens: int = None, output_tokens: int = None):
    return update_message_tokens_and_status(
        db=db,
        message_id=message_id,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


def update_message_status(db: Session, message_id: int, status: str, error_message: str | None = None):
    return update_message_tokens_and_status(
        db=db,
        message_id=message_id,
        status=status,
        error_message=error_message,
    )


def update_message_tokens_and_status(
    db: Session,
    message_id: int,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    status: str | None = None,
    error_message: str | None = None,
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        return None

    if input_tokens is not None:
        msg.input_tokens = input_tokens
    if output_tokens is not None:
        msg.output_tokens = output_tokens
    if status is not None:
        msg.status = status
    msg.error_message = error_message

    db.commit()
    db.refresh(msg)
    return msg
