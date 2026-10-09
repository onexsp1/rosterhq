import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routers import auth, users, teams, posts, events, messages
from app.config import STATIC_DIR, UPLOADS_DIR

# 1. Initialize Database
Base.metadata.create_all(bind=engine)

# 2. Ensure Storage Exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

# 3. App Setup
app = FastAPI(
    title="TeamConnect API",
    description="Refactored Modular API for Team Management",
    version="2.0.0"
)

# 4. Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Static Files
app.mount(f"/{STATIC_DIR}", StaticFiles(directory=STATIC_DIR), name="static")

# 6. Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(posts.router)
app.include_router(events.router)
app.include_router(messages.router)

@app.get("/")
async def root():
    return {"message": "TeamConnect API is running", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
