from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime

class UserSignUp(BaseModel):
    firstName: str
    lastName: str
    email: str
    password: str
    join_team_id: Optional[int] = None

class UserLogin(BaseModel):
    email: str
    password: str

class TeamCreate(BaseModel):
    name: str
    code: str

class JoinTeamRequest(BaseModel):
    code: str

class AdminToggleRequest(BaseModel):
    is_admin: bool

class EventCreate(BaseModel):
    title: str
    date: datetime
    address: str
    status: str

class RsvpCreate(BaseModel):
    status: str

class MessageCreate(BaseModel):
    content: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
