# 🎬 YouTube Watch Party

A real-time YouTube Watch Party application that allows multiple users to watch videos together in synchronized rooms.

Users can create or join rooms, watch YouTube videos together, control playback based on their roles, and communicate through real-time chat.

## 🚀 Live Demo

**Frontend:** https://youtube-watch-party-tau.vercel.app

**Backend:** https://youtube-watch-party-server-ggd0.onrender.com

**GitHub:** https://github.com/sujalchauhan98081-stack/youtube-watch-party

---

## ✨ Features

### 🏠 Room-Based Watch Parties

- Create a unique watch party room.
- Join an existing room using a Room ID.
- Display all participants currently in the room.
- Copy Room ID for easy sharing.
- Automatically remove disconnected users from the room.

### ▶️ Real-Time YouTube Synchronization

- Integrated with the YouTube IFrame Player API.
- Play/pause synchronization.
- Seek synchronization.
- Video change synchronization.
- Late joiners receive the current playback state.
- Playback state is maintained by the server.

### 👥 Role-Based Access Control

The application supports three roles:

| Role | Permissions |
|------|-------------|
| 👑 Host | Play, pause, seek, change video, assign moderators, remove participants, delete chat messages |
| 🛡️ Moderator | Play, pause, seek, change video |
| 👤 Participant | Watch videos and use chat |

Both the frontend **and backend** enforce permissions.

The backend never trusts the client's UI state and validates every restricted action.

### 💬 Real-Time Chat

- Room-based real-time chat.
- Messages are delivered instantly using Socket.IO.
- Chat history is sent to users when they join.
- Messages are limited to 500 characters.
- Latest 100 messages are retained per room.
- Host can delete chat messages.
- Username and role information are displayed.

### 🎨 UI/UX

- Responsive interface.
- Connection status indicator.
- Loading states for actions.
- Disabled controls when unavailable.
- Watch-only overlay for participants.
- Confirmation before removing participants.
- Clear Host / Moderator / Participant indicators.
- Copy Room ID functionality.

---

# 🛠️ Tech Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Socket.IO Client
- YouTube IFrame Player API

## Backend

- Node.js
- Express.js
- TypeScript
- Socket.IO
- CORS

## Testing

- Node.js Test Runner
- Socket.IO Client
- TypeScript Type Checking

## Deployment

- Vercel — Frontend
- Render — Backend

---

# 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │      React Client    │
                    │   TypeScript + Vite  │
                    └──────────┬───────────┘
                               │
                               │ Socket.IO
                               ▼
                    ┌──────────────────────┐
                    │    Node + Express    │
                    │      Socket.IO       │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       Room Management     RBAC Validation   Chat System
              │                │                │
              └────────────────┼────────────────┘
                               │
                               ▼
                         Room State
                               │
                               ▼
                    YouTube Playback State
```

The server acts as the **authoritative source of room state**.

Clients send actions to the server, the server validates the user's permissions, updates the room state, and broadcasts the resulting event to other users.

---

# 🔄 Real-Time Communication

Socket.IO is used for communication between the frontend and backend.

### Client → Server Events

```text
create_room
join_room
leave_room
play
pause
seek
change_video
assign_role
remove_participant
send_chat_message
delete_chat_message
```

### Server → Client Events

```text
room_created
room_joined
sync_state
play
pause
seek
video_changed
user_joined
user_left
role_assigned
participant_removed
chat_history
chat_message
chat_message_deleted
room_error
```

---

# ▶️ Playback Synchronization

Playback synchronization is server-authoritative.

When a Host or Moderator performs a playback action:

```text
User Action
    ↓
Socket.IO Event
    ↓
Backend Permission Check
    ↓
Room State Updated
    ↓
Broadcast Event
    ↓
Other Clients Update YouTube Player
```

The room maintains:

```ts
{
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedAt: number;
}
```

When a new participant joins, the server sends the current playback state.

If the video is currently playing, the client calculates the elapsed time since the state was generated and adjusts the playback position accordingly.

This helps late joiners start close to the current playback position.

---

# 🔐 Role-Based Access Control

### Host

The room creator becomes the Host.

The Host can:

- Play
- Pause
- Seek
- Change video
- Promote participants to Moderator
- Demote Moderators to Participant
- Remove participants
- Delete chat messages

### Moderator

A Moderator can:

- Play
- Pause
- Seek
- Change video

A Moderator cannot:

- Assign roles
- Remove participants
- Delete chat messages

### Participant

Participants can:

- Watch the synchronized video
- Send chat messages

Playback controls are disabled for Participants.

However, UI restrictions are not considered sufficient security.

The backend independently checks the user's role before processing every restricted event.

```text
Participant
     │
     │ play event
     ▼
Backend
     │
     │ role = participant
     ▼
Permission denied
```

This prevents users from bypassing the frontend and manually sending unauthorized Socket.IO events.

---

# 💬 Chat Architecture

Chat messages are handled through Socket.IO.

```text
User
 │
 │ send_chat_message
 ▼
Server
 │
 │ validate room membership
 │
 │ validate message
 ▼
Room Message Store
 │
 ▼
Broadcast chat_message
 │
 ├── Host
 ├── Moderator
 └── Participants
```

Messages are currently stored in memory and the latest 100 messages are retained for each room.

---

# 📁 Project Structure

```text
youtube-watch-party/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── YouTubePlayer.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   └── socket.ts
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/
│   ├── src/
│   │   ├── services/
│   │   │   └── roomManager.ts
│   │   ├── types/
│   │   │   ├── room.ts
│   │   │   └── socket.ts
│   │   ├── server.ts
│   │   └── *.test.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

---

# 💻 Local Development

## Prerequisites

- Node.js 20+
- npm
- Git

Check versions:

```bash
node -v
npm -v
git --version
```

## 1. Clone the Repository

```bash
git clone https://github.com/sujalchauhan98081-stack/youtube-watch-party.git
cd youtube-watch-party
```

## 2. Start the Backend

```bash
cd server
npm install
```

Create `.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
```

Start the development server:

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

## 3. Start the Frontend

Open another terminal:

```bash
cd client
npm install
```

Create `.env`:

```env
VITE_SERVER_URL=http://localhost:5000
```

Start Vite:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# 🧪 Testing

The backend contains unit tests and Socket.IO integration tests.

Run all server tests:

```bash
cd server
npm test
```

The test suite covers:

- Room creation
- Room joining
- Invalid room handling
- Host playback controls
- Participant permission restrictions
- Moderator permissions
- Role assignment
- Host protection
- Participant removal
- Disconnect handling
- Late-join synchronization
- Playback state synchronization
- Socket.IO room behavior

TypeScript validation:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

---

# 🌐 Production Deployment

## Frontend

The React frontend is deployed using Vercel.

```env
VITE_SERVER_URL=https://youtube-watch-party-server-ggd0.onrender.com
```

## Backend

The Node.js + Socket.IO server is deployed using Render.

```env
PORT=10000
CLIENT_URL=https://youtube-watch-party-tau.vercel.app
```

The server uses the platform-provided `PORT` value in production.

---

# ⚙️ Important Design Decisions

## Why Socket.IO?

Socket.IO provides:

- Real-time bidirectional communication
- Room support
- Automatic reconnection
- Event-based communication
- Convenient broadcasting

This makes it suitable for synchronizing playback and chat between multiple clients.

## Why Server-Authoritative State?

Instead of allowing clients to directly control synchronization state:

```text
Client
  ↓
Server validation
  ↓
Room state update
  ↓
Broadcast
```

This provides a single source of truth for the room.

## Why Backend RBAC?

Frontend controls can be modified or bypassed by users.

Therefore, permissions are checked again on the server.

```ts
if (requester.role !== "host") {
  sendPermissionError(
    socket,
    "Only the host can perform this action."
  );

  return;
}
```

This ensures that authorization is enforced independently of the UI.

---

# 📌 Current Limitations

### In-Memory Room State

Room information is stored in server memory.

If the backend restarts:

- Rooms are lost.
- Participants are disconnected.
- Chat history is lost.

### Single Server

The current implementation is designed for a single backend instance.

A horizontally scaled deployment would require shared state such as Redis.

### No Persistent Authentication

Users currently join using a username rather than a persistent authentication system.

---

# 🚀 Future Improvements

Possible production improvements include:

- Redis Pub/Sub for multi-server synchronization
- Persistent room storage
- User authentication
- JWT-based authorization
- Host transfer
- Persistent chat history
- Reactions
- Private messaging
- Room expiration
- Rate limiting
- Database-backed users and rooms
- Horizontal server scaling

---

# 📊 Quality & Engineering Practices

The project focuses on:

- TypeScript type safety
- Modular backend architecture
- Server-side permission validation
- Real-time event-driven communication
- Responsive UI
- Error handling
- Loading and connection states
- Unit testing
- Socket.IO integration testing
- Production builds
- Environment-based configuration

---

# 👨‍💻 Author

**Sujal Chauhan**

Computer Science & Engineering — AI & ML

GitHub:  
https://github.com/sujalchauhan98081-stack

---

# 📄 License

This project was developed as part of a technical evaluation and learning project.
