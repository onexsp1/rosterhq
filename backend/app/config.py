import os

# Security
SECRET_KEY = "YOUR_SUPER_SECRET_KEY_HERE"  # Change this in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Directories
STATIC_DIR = "static"
UPLOADS_DIR = "static/uploads"

# Database
SQLALCHEMY_DATABASE_URL = "sqlite:///./teamconnect.db"
