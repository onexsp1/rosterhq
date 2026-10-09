from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func
from ..database import get_db
from ..models import TeamTable, TeamMemberTable, UserTable, MessageTable
from ..schemas import TeamCreate, JoinTeamRequest, AdminToggleRequest
from ..dependencies import get_current_user

router = APIRouter(prefix="/teams", tags=["Teams"])

@router.get("")
async def get_my_teams(current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    memberships = db.query(TeamMemberTable).filter(TeamMemberTable.user_id == user.id).all()
    team_ids = [m.team_id for m in memberships]
    
    teams = db.query(TeamTable).filter(TeamTable.id.in_(team_ids)).all()
    
    result = []
    for team in teams:
        member_rec = next(m for m in memberships if m.team_id == team.id)
        result.append({
            "id": team.id,
            "name": team.name,
            "code": team.code,
            "isAdmin": member_rec.is_admin,
            "role": member_rec.role,
            "is_closed": team.is_closed
        })
    return result

@router.post("")
async def create_team(team: TeamCreate, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    
    new_team = TeamTable(
        name=team.name,
        code=team.code,
        owner_email=current_email
    )
    db.add(new_team)
    db.commit()
    db.refresh(new_team)

    membership = TeamMemberTable(
        user_id=user.id,
        team_id=new_team.id,
        is_admin=True,
        role="Coach/Owner"
    )
    db.add(membership)
    db.commit()
    
    return new_team

@router.get("/lookup/{code}")
async def lookup_team_by_code(code: str, db: Session = Depends(get_db)):
    # .upper() ensures that 'abc-123' and 'ABC-123' both work
    team = db.query(TeamTable).filter(TeamTable.code == code.upper()).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team with this code not found")
        
    # Return just the ID and Name so the Landing Screen can show it
    return {
        "id": team.id,
        "name": team.name,
        "is_closed": team.is_closed
    }

@router.post("/join")
async def join_team(req: JoinTeamRequest, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Verify User
    user = db.query(UserTable).filter(UserTable.email == current_email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized user")

    # 2. Verify Team
    team = db.query(TeamTable).filter(TeamTable.code == req.code).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team with this code not found")
        
    # ---------------------------------------------------------
    # --- NEW FIX: PREVENT JOINING CLOSED GROUPS --------------
    # ---------------------------------------------------------
    if getattr(team, 'is_closed', False): # Safely checks if is_closed is True
        raise HTTPException(
            status_code=403, 
            detail="This group is currently closed and not accepting new members."
        )
    # ---------------------------------------------------------
    
    # 3. Check if already a member
    existing = db.query(TeamMemberTable).filter(
        TeamMemberTable.user_id == user.id,
        TeamMemberTable.team_id == team.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this team")
    
    # 4. Check for active admins
    admin_count = db.query(TeamMemberTable).filter(
        TeamMemberTable.team_id == team.id,
        TeamMemberTable.is_admin == True
    ).count()

    if admin_count == 0:
        raise HTTPException(
            status_code=403, 
            detail="This team has no active admins and cannot accept new members."
        )
    
    # 5. Safely add the new member
    membership = TeamMemberTable(
        user_id=user.id,
        team_id=team.id,
        is_admin=False,
        role="Player"
    )
    db.add(membership)
    db.commit()
    
    return {"message": "Joined successfully", "team_id": team.id}

@router.get("/{team_id}")
async def get_team_details(team_id: int, db: Session = Depends(get_db)):
    team = db.query(TeamTable).filter(TeamTable.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team

# Make sure to import your Message table at the top of your file!
# from your_models_file import MessageTable, UserTable, TeamTable, TeamMemberTable

@router.get("/{team_id}/members")
async def get_team_members(team_id: int, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(TeamTable).filter(TeamTable.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    current_user = db.query(UserTable).filter(UserTable.email == current_email).first()
    memberships = db.query(TeamMemberTable).filter(TeamMemberTable.team_id == team_id).all()
    user_ids = [m.user_id for m in memberships]
    
    users = db.query(UserTable).filter(UserTable.id.in_(user_ids)).all()
    user_dict = {u.id: u for u in users}
    
    unread_counts = db.query(MessageTable.sender_id, func.count(MessageTable.id)).filter(
        MessageTable.team_id == team_id,
        MessageTable.receiver_id == current_user.id,
        MessageTable.is_read.isnot(True)
    ).group_by(MessageTable.sender_id).all()
    unread_dict = {sender_id: count for sender_id, count in unread_counts}

    result = []
    for m in memberships:
        u = user_dict.get(m.user_id)
        if u:
            unread_count = unread_dict.get(u.id, 0)
            result.append({
                "id": u.id,
                "firstName": u.firstName,
                "lastName": u.lastName,
                "email": u.email,
                "profile_picture": u.profile_picture,
                "isAdmin": m.is_admin,
                "role": m.role,
                "unread_count": unread_count
            })
    return result

@router.post("/{team_id}/members/{user_id}/toggle-admin")
async def toggle_admin(team_id: int, user_id: int, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify current user is an admin of this team
    me = db.query(UserTable).filter(UserTable.email == current_email).first()
    my_membership = db.query(TeamMemberTable).filter(
        TeamMemberTable.user_id == me.id,
        TeamMemberTable.team_id == team_id
    ).first()
    
    if not my_membership or not my_membership.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can manage roles")
    
    target_membership = db.query(TeamMemberTable).filter(
        TeamMemberTable.user_id == user_id,
        TeamMemberTable.team_id == team_id
    ).first()
    
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found")
    
    target_membership.is_admin = not target_membership.is_admin
    db.commit()
    return {"message": "Role updated"}

@router.delete("/{team_id}/members/{user_id}")
async def remove_member(team_id: int, user_id: int, current_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify current user is an admin of this team
    me = db.query(UserTable).filter(UserTable.email == current_email).first()
    my_membership = db.query(TeamMemberTable).filter(
        TeamMemberTable.user_id == me.id,
        TeamMemberTable.team_id == team_id
    ).first()
    
    if not my_membership or not my_membership.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can remove members")
        
    target_membership = db.query(TeamMemberTable).filter(
        TeamMemberTable.user_id == user_id,
        TeamMemberTable.team_id == team_id
    ).first()
    
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found")
        
    db.delete(target_membership)
    db.commit()
    return {"message": "Member removed"}

# Make sure to import your User model at the top!
# from models import TeamMemberTable, User 

@router.delete("/{team_id}/leave", status_code=status.HTTP_200_OK)
async def leave_team(
    team_id: int, 
    db: Session = Depends(get_db), 
    current_user_email: str = Depends(get_current_user) # Renamed for clarity!
):
    # 1. Look up the actual user using the email from the token
    user = db.query(UserTable).filter(UserTable.email == current_user_email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Could not validate credentials."
        )

    user_id = user.id

    # 2. Find the membership record linking this user to this team
    membership = db.query(TeamMemberTable).filter(
        TeamMemberTable.team_id == team_id,
        TeamMemberTable.user_id == user_id
    ).first()

    # 3. If they aren't in the team, return an error
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="You are not currently a member of this team."
        )

    # 4. Prevent the absolute owner from leaving 
    if membership.role == "owner":
        # Check if there are other admins/owners
        other_admins = db.query(TeamMemberTable).filter(
            TeamMemberTable.team_id == team_id,
            TeamMemberTable.user_id != user_id,
            TeamMemberTable.role.in_(["owner", "admin"])
        ).count()

        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are the only admin. You must delete the team or promote someone else to admin before leaving."
            )

    # 5. Safely delete the membership record
    try:
        db.delete(membership)
        db.commit()
        return {"status": "success", "message": f"Successfully left team {team_id}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not process your request to leave the team."
        )

@router.put("/{team_id}/close", status_code=status.HTTP_200_OK)
async def close_team(
    team_id: int, 
    db: Session = Depends(get_db), 
    current_user_email: str = Depends(get_current_user)
):
    # 1. Look up the user
    user = db.query(UserTable).filter(UserTable.email == current_user_email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # 2. Check if they are an admin of this team
    membership = db.query(TeamMemberTable).filter(
        TeamMemberTable.team_id == team_id,
        TeamMemberTable.user_id == user.id,
        TeamMemberTable.is_admin == True
    ).first()

    if not membership:
        raise HTTPException(status_code=403, detail="Only admins can close the group.")

    # 3. Find the team and close it
    team = db.query(TeamTable).filter(TeamTable.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    team.is_closed = True
    
    db.commit()
    return {"status": "success", "message": "Group closed successfully."}

@router.put("/{team_id}/reopen", status_code=status.HTTP_200_OK)
async def reopen_team(
    team_id: int, 
    db: Session = Depends(get_db), 
    current_user_email: str = Depends(get_current_user)
):
    # 1. Look up the user
    user = db.query(UserTable).filter(UserTable.email == current_user_email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # 2. Check if they are an admin
    membership = db.query(TeamMemberTable).filter(
        TeamMemberTable.team_id == team_id,
        TeamMemberTable.user_id == user.id,
        TeamMemberTable.is_admin == True
    ).first()

    if not membership:
        raise HTTPException(status_code=403, detail="Only admins can reopen the group.")

    # 3. Find the team and reopen it
    team = db.query(TeamTable).filter(TeamTable.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    team.is_closed = False  # <--- UNLOCK!
    
    db.commit()
    return {"status": "success", "message": "Group reopened successfully."}