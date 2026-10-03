import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import { RoomManager } from "./services/roomManager";

import {
  CreateRoomPayload,
  JoinRoomPayload,
  PlaybackPayload,
} from "./types/socket";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const roomManager = new RoomManager();

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Watch Party server is running",
  });
});

io.on("connection", (socket) => {
  console.log(
    `Client connected: ${socket.id}`
  );

  socket.emit("server:ready", {
    message: "Socket connection established",
  });

  socket.on(
    "create_room",
    (data: CreateRoomPayload) => {
      const roomId = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const host = {
        userId: socket.id,
        username: data.username,
        role: "host" as const,
      };

      const room =
        roomManager.createRoom(
          roomId,
          host
        );

      socket.join(roomId);

      socket.emit("room_created", {
        roomId: room.roomId,
        role: host.role,
        room,
      });

      console.log(
        `Room ${roomId} created by ${data.username} (${socket.id})`
      );
    }
  );

  socket.on(
    "join_room",
    (data: JoinRoomPayload) => {
      const room =
        roomManager.getRoom(
          data.roomId
        );

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

      roomManager.addParticipant(
        data.roomId,
        participant
      );

      socket.join(data.roomId);

      socket.emit("room_joined", {
        roomId: room.roomId,
        role: participant.role,
        room,
      });

      socket
        .to(data.roomId)
        .emit("user_joined", {
          participant,
        });

      console.log(
        `${data.username} joined room ${data.roomId} (${socket.id})`
      );
    }
  );

  socket.on(
    "play",
    (data: PlaybackPayload) => {
      console.log(
        "========== PLAY EVENT =========="
      );

      console.log(
        "Socket:",
        socket.id
      );

      console.log(
        "Room:",
        data.roomId
      );

      console.log(
        "Time:",
        data.currentTime
      );

      const room =
        roomManager.getRoom(
          data.roomId
        );

      if (!room) {
        console.log(
          "PLAY REJECTED: room does not exist"
        );

        socket.emit("room_error", {
          message: "Room does not exist",
        });

        return;
      }

      const participant =
        room.participants.find(
          (user) =>
            user.userId === socket.id
        );

      if (!participant) {
        console.log(
          "PLAY REJECTED: user is not a room member"
        );

        socket.emit("room_error", {
          message:
            "You are not a member of this room",
        });

        return;
      }

      if (
        participant.role !== "host" &&
        participant.role !== "moderator"
      ) {
        console.log(
          "PLAY REJECTED: insufficient permissions"
        );

        socket.emit("room_error", {
          message:
            "You do not have permission to control playback",
        });

        return;
      }

      room.currentTime =
        data.currentTime;

      room.isPlaying = true;

      console.log(
        "PLAY ACCEPTED. Broadcasting to room:",
        data.roomId
      );

      socket.to(data.roomId).emit(
        "play",
        {
          currentTime:
            room.currentTime,
        }
      );
    }
  );

  socket.on(
    "pause",
    (data: PlaybackPayload) => {
      console.log(
        "========== PAUSE EVENT =========="
      );

      console.log(
        "Socket:",
        socket.id
      );

      console.log(
        "Room:",
        data.roomId
      );

      console.log(
        "Time:",
        data.currentTime
      );

      const room =
        roomManager.getRoom(
          data.roomId
        );

      if (!room) {
        console.log(
          "PAUSE REJECTED: room does not exist"
        );

        socket.emit("room_error", {
          message: "Room does not exist",
        });

        return;
      }

      const participant =
        room.participants.find(
          (user) =>
            user.userId === socket.id
        );

      if (!participant) {
        console.log(
          "PAUSE REJECTED: user is not a room member"
        );

        socket.emit("room_error", {
          message:
            "You are not a member of this room",
        });

        return;
      }

      if (
        participant.role !== "host" &&
        participant.role !== "moderator"
      ) {
        console.log(
          "PAUSE REJECTED: insufficient permissions"
        );

        socket.emit("room_error", {
          message:
            "You do not have permission to control playback",
        });

        return;
      }

      room.currentTime =
        data.currentTime;

      room.isPlaying = false;

      console.log(
        "PAUSE ACCEPTED. Broadcasting to room:",
        data.roomId
      );

      socket.to(data.roomId).emit(
        "pause",
        {
          currentTime:
            room.currentTime,
        }
      );
    }
  );

  socket.on("disconnect", () => {
    console.log(
      `Client disconnected: ${socket.id}`
    );
  });
});

const PORT = 5000;

httpServer.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});