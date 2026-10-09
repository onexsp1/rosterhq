from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .database import Base

class UserTable(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    firstName = Column(String)
    lastName = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    profile_picture = Column(String, nullable=True)
    push_token = Column(String, nullable=True) # Store the ExponentPushToken here

class TeamTable(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    code = Column(String, unique=True)
    owner_email = Column(String)
    is_closed = Column(Boolean, default=False)

class TeamMemberTable(Base):
    __tablename__ = "team_members"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    team_id = Column(Integer, ForeignKey("teams.id"))
    is_admin = Column(Boolean, default=False)
    role = Column(String, default="Member")

class PostTable(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String)
    image_url = Column(String, nullable=True)
    team_id = Column(Integer, index=True)
    timestamp = Column(String)

class LikeTable(Base):
    __tablename__ = "likes"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, index=True)
    user_email = Column(String)

class ReplyTable(Base):
    __tablename__ = "replies"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, index=True)
    content = Column(String)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String)
    timestamp = Column(String)

class EventTable(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    title = Column(String)
    date = Column(DateTime)
    address = Column(String)
    status = Column(String, default="On Going")

class RsvpTable(Base):
    __tablename__ = "rsvps"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String)

class MessageTable(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String)
    timestamp = Column(String)
    is_read = Column(Boolean, default=False)

class PasswordResetTokenTable(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    code = Column(String, index=True)
    expires_at = Column(DateTime)
    is_used = Column(Boolean, default=False)
