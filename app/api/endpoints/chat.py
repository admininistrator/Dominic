from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.chat_schemas import (
    ChatRequest,
    ChatResponse,
    LoginRequest,
    LoginResponse,
    UsageResponse,
)
from app.services.chat_service import handle_chat, login_user, get_usage

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    try:
        result = login_user(db, request.username, request.password)
        return LoginResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage/{username}", response_model=UsageResponse)
def get_user_usage(username: str, db: Session = Depends(get_db)):
    try:
        result = get_usage(db, username)
        return UsageResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ChatResponse)
def send_message(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        result = handle_chat(db, request.username, request.message)
        return ChatResponse(
            success=True,
            reply=result["reply"],
            usage=result["usage"],
            request_id=result.get("request_id")
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))