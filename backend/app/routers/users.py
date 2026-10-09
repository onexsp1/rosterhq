from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile, Body
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os
import shutil
from ..database import get_db
from ..models import UserTable
from ..schemas import ChangePasswordRequest
from ..utils import verify_password, hash_password
from ..dependencies import get_current_user
from ..config import UPLOADS_DIR

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me")
async def get_me(current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/me")
async def update_me(
    firstName: str = Form(...),
    lastName: str = Form(...),
    image: Optional[UploadFile] = File(None),
    current_email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.firstName = firstName
    user.lastName = lastName
    
    if image:
        file_extension = image.filename.split(".")[-1]
        file_name = f"profile_{user.id}_{int(datetime.now().timestamp())}.{file_extension}"
        file_path = os.path.join(UPLOADS_DIR, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        user.profile_picture = file_path # Store as static/uploads/filename
    
    db.commit()
    db.refresh(user)
    return user

# --- NEW: SAVE PUSH TOKEN ROUTE ---
@router.post("/push-token")
async def save_push_token(
    # We use Body() since the frontend will send a JSON object: {"token": "..."}
    payload: dict = Body(...),
    current_email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    token = payload.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Push token is required")

    # Update the user's token in the database
    user.push_token = token
    db.commit()
    
    return {"status": "success", "message": "Push token updated"}

@router.post("/me/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(req.old_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
        
    user.password = hash_password(req.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}
