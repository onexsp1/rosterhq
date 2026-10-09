import requests
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from requests.exceptions import ConnectionError, HTTPError

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def send_team_notification(push_token: str, title: str, body: str, target_url: str):
    """
    Sends a push notification to an Expo app using Expo's Push API.
    """
    # Expo's official push notification endpoint
    url = "https://exp.host/--/api/v2/push/send"
    
    headers = {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }
    
    payload = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "badge": 1,
        "data": { "url": target_url } # This is the "hidden address" # Optional: Puts a red '1' on the app icon
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        
        # This will print the exact receipt from Expo!
        print(f"[EXPO RECEIPT] Status: {response.status_code} | Data: {response.json()}")
        
        return response.json()
    except Exception as e:
        print(f"[EXPO PUSH ERROR] Failed to send request: {e}")
        return None
