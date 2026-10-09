# RosterHQ 🏆

[![Expo](https://img.shields.io/badge/Expo-SDK%2054-blue.svg?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB.svg?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?logo=python)](https://python.org)
[![Firebase](https://img.shields.io/badge/Firebase-FCM%20v1-FFCA28.svg?logo=firebase)](https://firebase.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**RosterHQ** is an all-in-one mobile sports and team management platform built with **React Native (Expo SDK 54)** and **FastAPI**. It empowers coaches, players, and team organizers to manage schedules, track RSVPs, post announcements, share media, and communicate seamlessly with cross-platform push notifications.

---

## ✨ Features

- 👥 **Team Management & Rosters:** Create teams, organize players, view member profiles, and manage permissions.
- 📅 **Schedule & Event RSVP:** Schedule games and practices with date/time pickers and map locations. Track real-time attendance (*Going* vs. *Not Going*).
- 💬 **Team Community Feed:** Post team updates, announcements, photos, and video highlights with rich nested commenting.
- 🔔 **Instant Push Notifications:** Automated push notifications delivered via Firebase Cloud Messaging (FCM V1) and Expo Push Service whenever announcements, replies, or events are published.
- 🎨 **Adaptive UI & Themes:** Dark and light mode themes with custom palette styling, fluid transitions, and haptic feedback.
- 📱 **Smooth Mobile Experience:** Built with gesture handling, keyboard-avoiding bottom sheets, and native responsive layouts.

---

## 🛠️ Architecture & Tech Stack

```
 ┌────────────────────────────────────────┐
 │           RosterHQ Mobile App          │
 │       (React Native / Expo SDK 54)     │
 └───────────────────┬────────────────────┘
                     │ HTTP / REST & WebSockets
                     ▼
 ┌────────────────────────────────────────┐
 │           FastAPI Backend              │
 │         (Python, Pydantic, JWT)        │
 └─────────┬──────────────────┬───────────┘
           │                  │
           ▼                  ▼
    ┌─────────────┐    ┌────────────────────────┐
    │  Database   │    │    Expo Push Service   │
    │  (SQLite /  │    │           &            │
    │ PostgreSQL) │    │  Firebase FCM (Cloud)  │
    └─────────────┘    └────────────────────────┘
```

- **Frontend:** React Native, Expo Router (file-based navigation), TypeScript, Safe Area Context, Reanimated.
- **Backend:** FastAPI, Python, SQLAlchemy ORM, Pydantic, Passlib, python-jose (JWT).
- **Notifications:** Expo Push API with Google Firebase Cloud Messaging (FCM V1).
- **Storage:** Local static upload directory with media serving.

---

## 📁 Project Structure

```
my-team-app/
├── backend/
│   ├── app/
│   │   ├── routers/       # API route controllers (auth, teams, posts, events, users)
│   │   ├── config.py      # App configurations & secrets
│   │   ├── database.py    # Database connection engine
│   │   ├── models.py      # SQLAlchemy DB models
│   │   ├── schemas.py     # Pydantic request/response schemas
│   │   └── utils.py       # JWT security & Expo push notification dispatcher
│   ├── main.py            # FastAPI application entrypoint
│   └── requirements.txt   # Python backend dependencies
│
├── frontend/
│   ├── app/               # Expo Router file-based screens
│   │   ├── team/[id]/     # Team tabs (feed, schedule, chat, media)
│   │   ├── dashboard.tsx  # User dashboard & team selector
│   │   └── settings.tsx   # Profile & preferences
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks (auth, theme, sockets)
│   │   └── services/      # Axios/Fetch API client
│   ├── app.json           # Expo project configuration
│   └── eas.json           # Expo Application Services build profiles
│
├── .gitignore             # Multi-layer gitignore (secrets, media, node_modules)
└── README.md              # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or newer)
- **Python** (v3.10 or newer)
- **Git**
- **Expo Go** app installed on your iOS/Android device (or an Android Emulator / iOS Simulator)

---

### 1. Backend Setup

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create your `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

5. Start the backend server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   *The API will be available at `http://localhost:8000` (interactive documentation at `http://localhost:8000/docs`).*

---

### 2. Frontend Setup

1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables:
   ```bash
   cp .env.example .env
   ```
   > 💡 **Tip:** If testing on a physical phone on the same Wi-Fi network, set `EXPO_PUBLIC_API_URL` to your computer's local IP address (e.g., `http://192.168.1.XXX:8000`).

4. Start the Expo development server:
   ```bash
   npx expo start
   ```

5. Scan the QR code with **Expo Go** (Android) or the **Camera** app (iOS) to launch the app!

---

## 📦 Building Standalone Binaries (EAS Build)

Ensure you have EAS CLI installed:
```bash
npm install -g eas-cli
```

### Build a Shareable Android APK (Internal Testing)
```bash
cd frontend
eas build -p android --profile preview
```

### Build Google Play Store Bundle (.aab)
```bash
cd frontend
eas build -p android --profile production
```

---

## 🔒 Security & Best Practices

- **Never commit `.env` files** or Firebase private key files (`*-firebase-adminsdk-*.json`) to version control.
- In production, configure a cryptographically secure `SECRET_KEY` and store user uploads in secure cloud object storage (e.g. AWS S3, Cloudflare R2).

---

## 👨‍💻 Author

**Oneximo Sanchez**  
- GitHub: [@onexsp1](https://github.com/onexsp1)

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
