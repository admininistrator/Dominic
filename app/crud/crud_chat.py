from sqlalchemy.orm import Session
from app.models.chat_models import Message, User
from uuid import uuid4

def create_message(
    db: Session,
    role: str,
    sender_username: str,
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


def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


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
