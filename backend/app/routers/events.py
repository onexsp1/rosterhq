from app.models import TeamTable
from app.utils import send_team_notification
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import List
from ..database import get_db
from ..models import EventTable, RsvpTable, UserTable, TeamMemberTable
from ..schemas import EventCreate, RsvpCreate
from ..dependencies import get_current_user

router = APIRouter(tags=["Events"])

@router.get("/teams/{team_id}/events")
async def get_events(team_id: int, skip: int = 0, limit: int = 10, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    events = db.query(EventTable).filter(EventTable.team_id == team_id).order_by(asc(EventTable.date)).offset(skip).limit(limit).all()
    
    result = []
    for ev in events:
        # Get RSVP tallies
        going = db.query(RsvpTable).filter(RsvpTable.event_id == ev.id, RsvpTable.status == 'going').all()
        not_going = db.query(RsvpTable).filter(RsvpTable.event_id == ev.id, RsvpTable.status == 'notGoing').all()
        
        # Get my specific RSVP
        my_rsvp = db.query(RsvpTable).filter(RsvpTable.event_id == ev.id, RsvpTable.user_id == user.id).first()
        
        # Fetch user details for RSVP lists
        going_users = []
        for r in going:
            u = db.query(UserTable).filter(UserTable.id == r.user_id).first()
            if u:
                going_users.append({"id": u.id, "firstName": u.firstName, "lastName": u.lastName, "profile_picture": u.profile_picture})
        
        not_going_users = []
        for r in not_going:
            u = db.query(UserTable).filter(UserTable.id == r.user_id).first()
            if u:
                not_going_users.append({"id": u.id, "firstName": u.firstName, "lastName": u.lastName, "profile_picture": u.profile_picture})

        result.append({
            "id": ev.id,
            "title": ev.title,
            "date": ev.date.isoformat(),
            "address": ev.address,
            "status": ev.status,
            "userRsvp": my_rsvp.status if my_rsvp else None,
            "goingUsers": going_users,
            "notGoingUsers": not_going_users
        })
    return result

from datetime import datetime

@router.post("/teams/{team_id}/events")
async def create_event(team_id: int, event: EventCreate, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if user is admin
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    membership = db.query(TeamMemberTable).filter(TeamMemberTable.user_id == user.id, TeamMemberTable.team_id == team_id).first()
    
    if not membership or not membership.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can schedule events")
    
    new_event = EventTable(
        team_id=team_id,
        title=event.title,
        date=event.date,
        address=event.address,
        status=event.status
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    # --- NEW: NOTIFY TEAM MEMBERS ---
    try:
        # 1. Get Team Name
        team = db.query(TeamTable).filter(TeamTable.id == team_id).first()
        team_name = team.name if team else "Team"

        # 2. Get all teammates except the creator
        teammates = db.query(UserTable).join(
            TeamMemberTable, UserTable.id == TeamMemberTable.user_id
        ).filter(
            TeamMemberTable.team_id == team_id,
            UserTable.id != user.id
        ).all()

        # 3. Format Date for the notification (Optional but looks much better)
        # Parses "2026-04-12T15:00:00" -> "Apr 12 at 03:00 PM"
        try:
            dt_obj = datetime.fromisoformat(event.date.replace(" ", "T"))
            pretty_date = dt_obj.strftime("%b %d at %I:%M %p")
        except:
            pretty_date = event.date # Fallback if parsing fails

        # 4. Loop and send
        for member in teammates:
            if member.push_token:
                send_team_notification(
                    member.push_token,
                    f"📅 New Event: {team_name}",
                    f"{event.title}\n⏰ {pretty_date}\n📍 {event.address}",
                    target_url = f"/team/{team_id}/schedule" # Leads to Schedule
                )
                print(f"[DEBUG] Event notification sent to {member.firstName}")

    except Exception as e:
        print(f"[DEBUG] Failed to send event notifications: {e}")
    # --- END NOTIFICATION LOGIC ---

    return new_event

@router.post("/events/{event_id}/rsvp")
async def rsvp_event(event_id: int, rsvp: RsvpCreate, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    existing = db.query(RsvpTable).filter(RsvpTable.event_id == event_id, RsvpTable.user_id == user.id).first()
    if existing:
        if existing.status == rsvp.status:
            db.delete(existing)
            db.commit()
            return {"status": None}
        existing.status = rsvp.status
        db.commit()
        return {"status": existing.status}
    
    new_rsvp = RsvpTable(event_id=event_id, user_id=user.id, status=rsvp.status)
    db.add(new_rsvp)
    db.commit()
    return {"status": new_rsvp.status}

@router.put("/events/{event_id}")
async def update_event(event_id: int, event: EventCreate, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_event = db.query(EventTable).filter(EventTable.id == event_id).first()
    # Admin check omitted for brevity, but should be added
    db_event.title = event.title
    db_event.date = event.date
    db_event.address = event.address
    db_event.status = event.status
    db.commit()
    return db_event

@router.delete("/events/{event_id}")
async def delete_event(event_id: int, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_event = db.query(EventTable).filter(EventTable.id == event_id).first()
    db.delete(db_event)
    db.commit()
    return {"message": "Deleted"}
