from app.utils import send_team_notification
from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import List, Optional
import os
import shutil
from datetime import datetime
from ..database import get_db
from ..models import PostTable, LikeTable, ReplyTable, UserTable, TeamMemberTable, TeamTable
from ..dependencies import get_current_user
from ..config import UPLOADS_DIR

router = APIRouter(tags=["Posts"])

@router.get("/teams/{team_id}/posts")
async def get_posts(team_id: int, skip: int = 0, limit: int = 10, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    me = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    posts = db.query(PostTable).filter(PostTable.team_id == team_id).order_by(desc(PostTable.id)).offset(skip).limit(limit).all()
    
    result = []
    for post in posts:
        author = db.query(UserTable).filter(UserTable.id == post.author_id).first()
        likes_count = db.query(LikeTable).filter(LikeTable.post_id == post.id).count()
        is_liked = db.query(LikeTable).filter(LikeTable.post_id == post.id, LikeTable.user_email == current_email).first() is not None
        
        replies = db.query(ReplyTable).filter(ReplyTable.post_id == post.id).all()
        formatted_replies = []
        for r in replies:
            r_author = db.query(UserTable).filter(UserTable.id == r.author_id).first()
            formatted_replies.append({
                "id": r.id,
                "content": r.content,
                "author_id": r.author_id,
                "author_name": f"{r_author.firstName} {r_author.lastName}" if r_author else "Unknown",
                "author_avatar": r_author.profile_picture if r_author else None,
                "timestamp": r.timestamp
            })

        result.append({
            "id": post.id,
            "content": post.content,
            "author_id": post.author_id,
            "author_name": f"{author.firstName} {author.lastName}" if author else "Unknown",
            "author_avatar": author.profile_picture if author else None,
            "image_url": post.image_url,
            "timestamp": post.timestamp,
            "likes": likes_count,
            "isLikedByMe": is_liked,
            "replies": formatted_replies
        })
    return result

@router.post("/posts")
async def create_post(
    content: str = Form(""),
    team_id: int = Form(...),
    image: Optional[UploadFile] = File(None),
    current_email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    image_path = None
    if image:
        file_extension = image.filename.split(".")[-1]
        file_name = f"post_{user.id}_{int(datetime.now().timestamp())}.{file_extension}"
        file_path = os.path.join(UPLOADS_DIR, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_path = file_path

    new_post = PostTable(
        content=content,
        author_id=user.id,
        author_name=f"{user.firstName} {user.lastName}",
        image_url=image_path,
        team_id=team_id,
        timestamp=datetime.now().isoformat()
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
   # --- NEW: NOTIFY TEAM MEMBERS (LOUD DEBUG VERSION) ---
    try:
        print(f"\n[DEBUG] Post created! Searching for teammates in team_id: {team_id}")
        team = db.query(TeamTable).filter(TeamTable.id == team_id).first()

        # Safely join the tables to find all OTHER teammates
        all_teammates = db.query(UserTable).join(
            TeamMemberTable, UserTable.id == TeamMemberTable.user_id
        ).filter(
            TeamMemberTable.team_id == team_id,
            UserTable.id != user.id
        ).all()
        
        print(f"[DEBUG] Found {len(all_teammates)} other teammates.")
        body_text = content[:50] + "..." if content else "Sent Media File"
        for member in all_teammates:
            print(f"[DEBUG] Checking teammate: {member.firstName} | Token in DB: {member.push_token}")
            if member.push_token:
                print(f"[DEBUG] ---> Attempting to send push to {member.firstName}...")
                send_team_notification(
                    member.push_token,
                    f"New Post in {team.name if team else 'Team'}",
                    f"{user.firstName}: {body_text}",
                    target_url = f"/team/{team_id}/"
                )
            else:
                print(f"[DEBUG] ---> Skipped {member.firstName}: No push_token in database.")
                
    except Exception as e:
        print(f"[DEBUG] CRITICAL Notification Error: {e}")
    print("\n")
    return new_post

@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: int, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(LikeTable).filter(LikeTable.post_id == post_id, LikeTable.user_email == current_email).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False}
    
    new_like = LikeTable(post_id=post_id, user_email=current_email)
    db.add(new_like)
    db.commit()
    return {"liked": True}

@router.post("/posts/{post_id}/replies")
async def add_reply(post_id: int, content: str = Form(...), current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    new_reply = ReplyTable(
        post_id=post_id,
        content=content,
        author_id=user.id,
        author_name=f"{user.firstName} {user.lastName}",
        timestamp=datetime.now().isoformat()
    )
    db.add(new_reply)
    db.commit()
    # --- NEW: NOTIFY THE POST AUTHOR ---
    try:
        post = db.query(PostTable).filter(PostTable.id == post_id).first()
        # Only notify if the person replying isn't the one who made the post
        if post and post.author_id != user.id:
            author = db.query(UserTable).filter(UserTable.id == post.author_id).first()
            if author and author.push_token:
                send_team_notification(
                    author.push_token,
                    f"{user.firstName} replied to your post",
                    content[:50]
                )
    except Exception as e:
        print(f"Reply Notification Error: {e}")
    return new_reply

@router.get("/teams/{team_id}/media")
async def get_media(team_id: int, skip: int = 0, limit: int = 15, db: Session = Depends(get_db)):
    posts = db.query(PostTable).filter(
        PostTable.team_id == team_id,
        PostTable.image_url != None
    ).order_by(desc(PostTable.id)).offset(skip).limit(limit).all()
    
    result = []
    for post in posts:
        author = db.query(UserTable).filter(UserTable.id == post.author_id).first()
        result.append({
            "id": post.id,
            "image_url": post.image_url,
            "author_name": f"{author.firstName} {author.lastName}" if author else "Unknown",
            "author_id": post.author_id,
            "author_avatar": author.profile_picture if author else None
        })
    return result

@router.delete("/posts/{post_id}")
async def delete_post(post_id: int, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(PostTable).filter(PostTable.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
        
    # Cleanup file
    if post.image_url:
        try:
            if os.path.exists(post.image_url):
                os.remove(post.image_url)
        except:
            pass
            
    # Cleanup likes & replies
    db.query(LikeTable).filter(LikeTable.post_id == post_id).delete()
    db.query(ReplyTable).filter(ReplyTable.post_id == post_id).delete()
    
    db.delete(post)
    db.commit()
    return {"message": "Post deleted"}

@router.put("/posts/{post_id}")
async def update_post(post_id: int, content_update: dict, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(PostTable).filter(PostTable.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")
        
    post.content = content_update.get("content", post.content)
    db.commit()
    return post
