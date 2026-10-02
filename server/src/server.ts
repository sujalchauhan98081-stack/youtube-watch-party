import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { RoomManager } from "./services/roomManager";
import {
  CreateRoomPayload,
  JoinRoomPayload,
} from "./types/socket";

const app = express();  // creates our http application

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {  // creates our Socket.io server
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Watch Party server is running",
  });
});

const roomManager = new RoomManager();

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("create_room", (data: CreateRoomPayload) => {
  const roomId = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  const host = {
    userId: socket.id,
    username: data.username,
    role: "host" as const,
  };

  const room = roomManager.createRoom(roomId, host);

  socket.join(roomId);

  socket.emit("room_created", {
    roomId: room.roomId,
    role: host.role,
    room,
  });

  console.log(
    `Room ${roomId} created by ${data.username} (${socket.id})`
  );
});
socket.on("join_room", (data: JoinRoomPayload) => {
  const room = roomManager.getRoom(data.roomId);

  if (!room) {
    socket.emit("room_error", {
      message: "Room does not exist",
    });

    return;
  }

  const participant = {
    userId: socket.id,
    username: data.username,
    role: "participant" as const,
  };

  roomManager.addParticipant(data.roomId, participant);

  socket.join(data.roomId);

  socket.emit("room_joined", {
    roomId: room.roomId,
    role: participant.role,
    room,
  });

  socket.to(data.roomId).emit("user_joined", {
    participant,
  });

  console.log(
    `${data.username} joined room ${data.roomId} (${socket.id})`
  );
});

  socket.emit("server:ready", {
    message: "Socket connection established",
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});