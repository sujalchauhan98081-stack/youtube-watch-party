import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import { RoomManager } from "./services/roomManager";
import {
  CreateRoomPayload,
  JoinRoomPayload,
  PlaybackPayload,
  ChangeVideoPayload,
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
  console.log(`Client connected: ${socket.id}`);

  socket.emit("server:ready", {
    message: "Socket connection established",
  });

  // =========================
  // CREATE ROOM
  // =========================

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

    console.log(`ROOM CREATED: ${roomId} by ${host.username}`);
  });

  // =========================
  // JOIN ROOM
  // =========================

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

    // Calculate the real current position.
    let syncTime = room.currentTime;

    if (room.isPlaying) {
      syncTime +=
        (Date.now() - room.lastUpdatedAt) / 1000;
    }

    console.log(
      `SYNC STATE -> ${participant.username}:`,
      {
        videoId: room.videoId,
        currentTime: syncTime,
        isPlaying: room.isPlaying,
      }
    );

    socket.emit("sync_state", {
      videoId: room.videoId,
      currentTime: syncTime,
      isPlaying: room.isPlaying,
    });

    socket.to(data.roomId).emit("user_joined", {
      participant,
    });

    console.log(
      `USER JOINED: ${participant.username} -> ${data.roomId}`
    );
  });

  // =========================
  // PLAY
  // =========================

  socket.on("play", (data: PlaybackPayload) => {
    const room = roomManager.getRoom(data.roomId);

    if (!room) {
      socket.emit("room_error", {
        message: "Room does not exist",
      });

      return;
    }

    const participant = room.participants.find(
      (user) => user.userId === socket.id
    );

    if (!participant) {
      socket.emit("room_error", {
        message: "You are not a member of this room",
      });

      return;
    }

    if (
      participant.role !== "host" &&
      participant.role !== "moderator"
    ) {
      socket.emit("room_error", {
        message:
          "You do not have permission to control playback",
      });

      return;
    }

    room.currentTime = data.currentTime;
    room.isPlaying = true;
    room.lastUpdatedAt = Date.now();

    console.log(
      `PLAY EVENT: ${participant.username} -> ${room.currentTime}s`
    );

    socket.to(data.roomId).emit("play", {
      currentTime: room.currentTime,
    });
  });

  // =========================
  // PAUSE
  // =========================

  socket.on("pause", (data: PlaybackPayload) => {
    const room = roomManager.getRoom(data.roomId);

    if (!room) {
      socket.emit("room_error", {
        message: "Room does not exist",
      });

      return;
    }

    const participant = room.participants.find(
      (user) => user.userId === socket.id
    );

    if (!participant) {
      socket.emit("room_error", {
        message: "You are not a member of this room",
      });

      return;
    }

    if (
      participant.role !== "host" &&
      participant.role !== "moderator"
    ) {
      socket.emit("room_error", {
        message:
          "You do not have permission to control playback",
      });

      return;
    }

    if (room.isPlaying) {
      room.currentTime +=
        (Date.now() - room.lastUpdatedAt) / 1000;
    }

    room.isPlaying = false;
    room.lastUpdatedAt = Date.now();

    console.log(
      `PAUSE EVENT: ${participant.username} -> ${room.currentTime}s`
    );

    socket.to(data.roomId).emit("pause", {
      currentTime: room.currentTime,
    });
  });

  // =========================
  // SEEK
  // =========================

  socket.on("seek", (data: PlaybackPayload) => {
    const room = roomManager.getRoom(data.roomId);

    if (!room) {
      socket.emit("room_error", {
        message: "Room does not exist",
      });

      return;
    }

    const participant = room.participants.find(
      (user) => user.userId === socket.id
    );

    if (!participant) {
      socket.emit("room_error", {
        message: "You are not a member of this room",
      });

      return;
    }

    if (
      participant.role !== "host" &&
      participant.role !== "moderator"
    ) {
      socket.emit("room_error", {
        message:
          "You do not have permission to control playback",
      });

      return;
    }

    room.currentTime = data.currentTime;
    room.lastUpdatedAt = Date.now();

    console.log(
      `SEEK EVENT: ${participant.username} -> ${room.currentTime}s`
    );

    socket.to(data.roomId).emit("seek", {
      currentTime: room.currentTime,
    });
  });

  // =========================
  // CHANGE VIDEO
  // =========================

  socket.on(
    "change_video",
    (data: ChangeVideoPayload) => {
      const room = roomManager.getRoom(data.roomId);

      if (!room) {
        socket.emit("room_error", {
          message: "Room does not exist",
        });

        return;
      }

      const participant = room.participants.find(
        (user) => user.userId === socket.id
      );

      if (!participant) {
        socket.emit("room_error", {
          message: "You are not a member of this room",
        });

        return;
      }

      if (
        participant.role !== "host" &&
        participant.role !== "moderator"
      ) {
        socket.emit("room_error", {
          message:
            "You do not have permission to change the video",
        });

        return;
      }

      if (!data.videoId.trim()) {
        socket.emit("room_error", {
          message: "Video ID is required",
        });

        return;
      }

      room.videoId = data.videoId.trim();
      room.currentTime = 0;
      room.isPlaying = false;
      room.lastUpdatedAt = Date.now();

      console.log(
        `VIDEO CHANGE: ${participant.username} -> ${room.videoId}`
      );

      io.to(data.roomId).emit("video_changed", {
        videoId: room.videoId,
      });
    }
  );
});

// =========================
// SERVER START
// =========================

const PORT = 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});