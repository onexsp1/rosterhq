from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from typing import List, Dict
from datetime import datetime
from ..database import get_db
from ..models import MessageTable, UserTable
from ..schemas import MessageCreate
from ..dependencies import get_current_user

router = APIRouter(tags=["Messaging"])

# --- WEBSOCKET CONNECTION MANAGER (SINGLETON) ---
class ConnectionManager:
    def __init__(self):
        # Maps user_id -> WebSocket
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception:
                self.disconnect(user_id)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep the connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)

@router.get("/teams/{team_id}/messages/{other_user_id}")
async def get_messages(team_id: int, other_user_id: int, skip: int = 0, limit: int = 20, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    me = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    messages = db.query(MessageTable).filter(
        MessageTable.team_id == team_id,
        or_(
            and_(MessageTable.sender_id == me.id, MessageTable.receiver_id == other_user_id),
            and_(MessageTable.sender_id == other_user_id, MessageTable.receiver_id == me.id)
        )
    ).order_by(desc(MessageTable.id)).offset(skip).limit(limit).all()
    
    return messages

@router.post("/teams/{team_id}/messages/{receiver_id}")
async def send_message(team_id: int, receiver_id: int, msg: MessageCreate, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    me = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    new_msg = MessageTable(
        team_id=team_id,
        sender_id=me.id,
        receiver_id=receiver_id,
        content=msg.content,
        # --- FIX: Ensure full ISO format string is saved ---
        timestamp=datetime.now().isoformat(),
        is_read=False
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    
    # Send via WebSockets WITH the newly created ID
    await manager.send_personal_message({
        "type": "new_message",
        "id": new_msg.id,              # <-- Crucial for React performance!
        "sender_id": me.id,
        "content": new_msg.content,
        # --- FIX: Stringify the ISO timestamp ---
        "timestamp": str(new_msg.timestamp)
    }, receiver_id)
    
    return new_msg

@router.post("/teams/{team_id}/messages/{other_user_id}/read")
async def mark_as_read(team_id: int, other_user_id: int, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    me = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    db.query(MessageTable).filter(
        MessageTable.team_id == team_id,
        MessageTable.sender_id == other_user_id,
        MessageTable.receiver_id == me.id,
        MessageTable.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    return {"status": "success"}