from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from sqlalchemy.orm import Session
import os
import shutil
import random
from datetime import datetime, timedelta
from ..database import get_db
from ..models import UserTable, TeamMemberTable, PasswordResetTokenTable
from ..schemas import UserSignUp, UserLogin, ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest
from ..utils import hash_password, verify_password, create_access_token
from ..dependencies import get_current_user
from ..config import UPLOADS_DIR

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup")
async def signup(user: UserSignUp, db: Session = Depends(get_db)):
    existing = db.query(UserTable).filter(UserTable.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = UserTable(
        firstName=user.firstName,
        lastName=user.lastName,
        email=user.email,
        password=hash_password(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if user.join_team_id:
        membership = TeamMemberTable(
            user_id=new_user.id,
            team_id=user.join_team_id,
            is_admin=False,
            role="Player"
        )
        db.add(membership)
        db.commit()

    # Log them in automatically
    access_token = create_access_token(data={"sub": new_user.email})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "firstName": new_user.firstName,
            "lastName": new_user.lastName,
            "email": new_user.email,
            "profile_picture": new_user.profile_picture
        }
    }

@router.post("/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(UserTable).filter(UserTable.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": db_user.email})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "firstName": db_user.firstName,
            "lastName": db_user.lastName,
            "email": db_user.email,
        }
    }

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(UserTable).filter(UserTable.email == req.email).first()
    if not user:
        # Secure practice: Do not reveal if the email exists. Show success anyway.
        return {"message": "If an account exists, a code was sent."}

    # Invalidate previous tokens
    db.query(PasswordResetTokenTable).filter(
        PasswordResetTokenTable.email == user.email,
        PasswordResetTokenTable.is_used == False
    ).update({"is_used": True})
    
    # Generate 6 digit code
    code = str(random.randint(100000, 999999))
    expires = datetime.utcnow() + timedelta(minutes=15)
    
    reset_token = PasswordResetTokenTable(
        email=user.email,
        code=code,
        expires_at=expires
    )
    db.add(reset_token)
    db.commit()

    # Development mode logging:
    print(f"\n======================================")
    print(f"RESET CODE for {user.email}: {code}")
    print(f"======================================\n")

    return {"message": "If an account exists, a code was sent."}

@router.post("/verify-reset-code")
async def verify_reset_code(req: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    token = db.query(PasswordResetTokenTable).filter(
        PasswordResetTokenTable.email == req.email,
        PasswordResetTokenTable.code == req.code,
        PasswordResetTokenTable.is_used == False
    ).first()

    if not token:
        raise HTTPException(status_code=400, detail="Invalid reset code.")
    if datetime.utcnow() > token.expires_at:
        raise HTTPException(status_code=400, detail="This code has expired.")
    
    return {"message": "Code is valid."}

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    token = db.query(PasswordResetTokenTable).filter(
        PasswordResetTokenTable.email == req.email,
        PasswordResetTokenTable.code == req.code,
        PasswordResetTokenTable.is_used == False
    ).first()

    if not token or datetime.utcnow() > token.expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")

    user = db.query(UserTable).filter(UserTable.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password = hash_password(req.new_password)
    token.is_used = True
    
    db.commit()
    return {"message": "Password updated successfully."}
