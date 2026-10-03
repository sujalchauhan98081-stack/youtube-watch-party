import cors from "cors";
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

import { RoomManager } from "./services/roomManager.js";
import type { Participant, Role } from "./types/room.js";
import type {
  AssignRolePayload,
  ChangeVideoPayload,
  CreateRoomPayload,
  JoinRoomPayload,
  PlaybackPayload,
  RemoveParticipantPayload,
} from "./types/socket.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
  })
);

app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

const roomManager = new RoomManager();
/* -------------------------------------------------------------------------- */
/*                                HTTP ROUTES                                 */
/* -------------------------------------------------------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Watch Party server is running",
  });
});

/* -------------------------------------------------------------------------- */
/*                               HELPER FUNCTIONS                             */
/* -------------------------------------------------------------------------- */

function generateRoomId(): string {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

function getParticipant(
  socket: Socket,
  roomId: string
): Participant | undefined {
  return roomManager.getParticipant(
    roomId,
    socket.id
  );
}

function isController(role: Role): boolean {
  return (
    role === "host" ||
    role === "moderator"
  );
}

function hasRoomAccess(
  socket: Socket,
  roomId: string
): boolean {
  return socket.data.roomId === roomId;
}

function sendPermissionError(
  socket: Socket,
  message: string
): void {
  socket.emit("room_error", {
    message,
  });
}

/* -------------------------------------------------------------------------- */
/*                              SOCKET CONNECTION                             */
/* -------------------------------------------------------------------------- */

io.on("connection", (socket) => {
  console.log(
    `Socket connected: ${socket.id}`
  );

  socket.emit("server:ready", {
    message: "Connected to Watch Party server",
  });

  /* ---------------------------------------------------------------------- */
  /*                              CREATE ROOM                               */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "create_room",
    (data: CreateRoomPayload) => {
      const roomId = generateRoomId();

      const host: Participant = {
        userId: socket.id,
        username:
          data.username?.trim() || "Host",
        role: "host",
      };

      const room =
        roomManager.createRoom(
          roomId,
          host
        );

      socket.data.roomId = roomId;

      socket.join(roomId);

      socket.emit("room_created", {
        roomId: room.roomId,
        role: host.role,
        room,
      });

      console.log(
        `Room ${roomId} created by ${host.username}`
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                               JOIN ROOM                                */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "join_room",
    (data: JoinRoomPayload) => {
      const roomId =
        data.roomId?.trim().toUpperCase();

      const username =
        data.username?.trim() || "Participant";

      if (!roomId) {
        sendPermissionError(
          socket,
          "Room ID is required."
        );
        return;
      }

      const room =
        roomManager.getRoom(roomId);

      if (!room) {
        socket.emit("room_error", {
          message: "Room not found.",
        });

        return;
      }

      const participant: Participant = {
        userId: socket.id,
        username,
        role: "participant",
      };

      const updatedRoom =
        roomManager.addParticipant(
          roomId,
          participant
        );

      if (!updatedRoom) {
        socket.emit("room_error", {
          message: "Unable to join room.",
        });

        return;
      }

      socket.data.roomId = roomId;

      socket.join(roomId);

      socket.emit("room_joined", {
        roomId: updatedRoom.roomId,
        role: participant.role,
        room: updatedRoom,
      });

      /* ------------------------------------------------------------------ */
      /*                       LATE JOIN SYNCHRONIZATION                    */
      /* ------------------------------------------------------------------ */

      let syncTime =
        updatedRoom.currentTime;

      if (updatedRoom.isPlaying) {
        syncTime +=
          (Date.now() -
            updatedRoom.lastUpdatedAt) /
          1000;
      }

      socket.emit("sync_state", {
        videoId: updatedRoom.videoId,
        currentTime: syncTime,
        isPlaying: updatedRoom.isPlaying,
      });

      /* ------------------------------------------------------------------ */
      /*                            USER JOINED                              */
      /* ------------------------------------------------------------------ */

      socket.to(roomId).emit(
        "user_joined",
        {
          participant,
        }
      );

      console.log(
        `${username} joined room ${roomId}`
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                                PLAY                                    */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "play",
    (data: PlaybackPayload) => {
      const roomId = data.roomId;

      if (
        !hasRoomAccess(
          socket,
          roomId
        )
      ) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      const room =
        roomManager.getRoom(roomId);

      if (!room) {
        sendPermissionError(
          socket,
          "Room not found."
        );
        return;
      }

      const participant =
        getParticipant(
          socket,
          roomId
        );

      if (!participant) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      if (
        !isController(
          participant.role
        )
      ) {
        sendPermissionError(
          socket,
          "You do not have permission to control playback."
        );
        return;
      }

      room.currentTime =
        data.currentTime;

      room.isPlaying = true;

      room.lastUpdatedAt =
        Date.now();

      socket.to(roomId).emit(
        "play",
        {
          currentTime:
            room.currentTime,
        }
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                                PAUSE                                   */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "pause",
    (data: PlaybackPayload) => {
      const roomId = data.roomId;

      if (
        !hasRoomAccess(
          socket,
          roomId
        )
      ) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      const room =
        roomManager.getRoom(roomId);

      if (!room) {
        sendPermissionError(
          socket,
          "Room not found."
        );
        return;
      }

      const participant =
        getParticipant(
          socket,
          roomId
        );

      if (!participant) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      if (
        !isController(
          participant.role
        )
      ) {
        sendPermissionError(
          socket,
          "You do not have permission to control playback."
        );
        return;
      }

      if (room.isPlaying) {
        room.currentTime +=
          (Date.now() -
            room.lastUpdatedAt) /
          1000;
      }

      room.isPlaying = false;

      room.lastUpdatedAt =
        Date.now();

      socket.to(roomId).emit(
        "pause",
        {
          currentTime:
            room.currentTime,
        }
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                                 SEEK                                   */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "seek",
    (data: PlaybackPayload) => {
      const roomId = data.roomId;

      if (
        !hasRoomAccess(
          socket,
          roomId
        )
      ) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      const room =
        roomManager.getRoom(roomId);

      if (!room) {
        sendPermissionError(
          socket,
          "Room not found."
        );
        return;
      }

      const participant =
        getParticipant(
          socket,
          roomId
        );

      if (!participant) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      if (
        !isController(
          participant.role
        )
      ) {
        sendPermissionError(
          socket,
          "You do not have permission to control playback."
        );
        return;
      }

      room.currentTime =
        data.currentTime;

      room.lastUpdatedAt =
        Date.now();

      socket.to(roomId).emit(
        "seek",
        {
          currentTime:
            room.currentTime,
        }
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                            CHANGE VIDEO                                */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "change_video",
    (data: ChangeVideoPayload) => {
      const roomId = data.roomId;

      if (
        !hasRoomAccess(
          socket,
          roomId
        )
      ) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      const room =
        roomManager.getRoom(roomId);

      if (!room) {
        sendPermissionError(
          socket,
          "Room not found."
        );
        return;
      }

      const participant =
        getParticipant(
          socket,
          roomId
        );

      if (!participant) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      if (
        !isController(
          participant.role
        )
      ) {
        sendPermissionError(
          socket,
          "You do not have permission to change the video."
        );
        return;
      }

      const videoId =
        data.videoId?.trim();

      if (!videoId) {
        sendPermissionError(
          socket,
          "Video ID is required."
        );
        return;
      }

      room.videoId = videoId;

      room.currentTime = 0;

      room.isPlaying = false;

      room.lastUpdatedAt =
        Date.now();

      io.to(roomId).emit(
        "video_changed",
        {
          videoId: room.videoId,
        }
      );

      console.log(
        `Video changed in room ${roomId}: ${videoId}`
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                            ASSIGN ROLE                                 */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "assign_role",
    (data: AssignRolePayload) => {
      const roomId = data.roomId;

      if (
        !hasRoomAccess(
          socket,
          roomId
        )
      ) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      const room =
        roomManager.getRoom(roomId);

      if (!room) {
        sendPermissionError(
          socket,
          "Room not found."
        );
        return;
      }

      const requester =
        getParticipant(
          socket,
          roomId
        );

      if (!requester) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      if (
        requester.role !== "host"
      ) {
        sendPermissionError(
          socket,
          "Only the host can assign roles."
        );
        return;
      }

      if (
        data.role !==
          "moderator" &&
        data.role !==
          "participant"
      ) {
        sendPermissionError(
          socket,
          "Invalid role."
        );
        return;
      }

      const target =
        roomManager.getParticipant(
          roomId,
          data.userId
        );

      if (!target) {
        sendPermissionError(
          socket,
          "Participant not found."
        );
        return;
      }

      if (
        target.role === "host"
      ) {
        sendPermissionError(
          socket,
          "The host role cannot be changed."
        );
        return;
      }

      const updatedParticipant =
        roomManager.updateParticipantRole(
          roomId,
          data.userId,
          data.role
        );

      if (!updatedParticipant) {
        sendPermissionError(
          socket,
          "Unable to assign role."
        );
        return;
      }

      const updatedRoom =
        roomManager.getRoom(
          roomId
        );

      if (!updatedRoom) {
        return;
      }

      io.to(roomId).emit(
        "role_assigned",
        {
          userId:
            updatedParticipant.userId,
          username:
            updatedParticipant.username,
          role:
            updatedParticipant.role,
          participants:
            updatedRoom.participants,
        }
      );

      console.log(
        `${updatedParticipant.username} is now ${updatedParticipant.role} in room ${roomId}`
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                          REMOVE PARTICIPANT                            */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "remove_participant",
    (
      data: RemoveParticipantPayload
    ) => {
      const roomId = data.roomId;

      if (
        !hasRoomAccess(
          socket,
          roomId
        )
      ) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      const room =
        roomManager.getRoom(roomId);

      if (!room) {
        sendPermissionError(
          socket,
          "Room not found."
        );
        return;
      }

      const requester =
        getParticipant(
          socket,
          roomId
        );

      if (!requester) {
        sendPermissionError(
          socket,
          "You are not a member of this room."
        );
        return;
      }

      if (
        requester.role !== "host"
      ) {
        sendPermissionError(
          socket,
          "Only the host can remove participants."
        );
        return;
      }

      const target =
        roomManager.getParticipant(
          roomId,
          data.userId
        );

      if (!target) {
        sendPermissionError(
          socket,
          "Participant not found."
        );
        return;
      }

      if (
        target.role === "host"
      ) {
        sendPermissionError(
          socket,
          "The host cannot be removed."
        );
        return;
      }

      const targetSocket =
        io.sockets.sockets.get(
          target.userId
        );

      roomManager.removeParticipant(
        roomId,
        target.userId
      );

      if (targetSocket) {
        targetSocket.leave(roomId);
        targetSocket.data.roomId =
          undefined;

        targetSocket.emit(
          "participant_removed",
          {
            userId:
              target.userId,
            message:
              "You have been removed from the room.",
          }
        );
      }

      const updatedRoom =
        roomManager.getRoom(
          roomId
        );

      if (!updatedRoom) {
        return;
      }

      socket.emit(
        "participant_removed",
        {
          userId:
            target.userId,
          participants:
            updatedRoom.participants,
        }
      );

      socket.to(roomId).emit(
        "participant_removed",
        {
          userId:
            target.userId,
          participants:
            updatedRoom.participants,
        }
      );

      console.log(
        `${target.username} was removed from room ${roomId}`
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                              LEAVE ROOM                                */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "leave_room",
    (data: {
      roomId: string;
    }) => {
      const roomId =
        data.roomId;

      if (
        !hasRoomAccess(
          socket,
          roomId
        )
      ) {
        return;
      }

      const participant =
        getParticipant(
          socket,
          roomId
        );

      if (!participant) {
        return;
      }

      const updatedRoom =
        roomManager.removeParticipant(
          roomId,
          socket.id
        );

      socket.leave(roomId);

      socket.data.roomId =
        undefined;

      if (!updatedRoom) {
        return;
      }

      socket.to(roomId).emit(
        "user_left",
        {
          participant,
          participants:
            updatedRoom.participants,
        }
      );

      console.log(
        `${participant.username} left room ${roomId}`
      );
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                              DISCONNECT                                */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "disconnect",
    () => {
      const roomId =
        socket.data.roomId as
          | string
          | undefined;

      if (!roomId) {
        console.log(
          `Socket disconnected: ${socket.id}`
        );

        return;
      }

      const participant =
        roomManager.getParticipant(
          roomId,
          socket.id
        );

      if (!participant) {
        console.log(
          `Socket disconnected: ${socket.id}`
        );

        return;
      }

      const updatedRoom =
        roomManager.removeParticipant(
          roomId,
          socket.id
        );

      if (updatedRoom) {
        socket.to(roomId).emit(
          "user_left",
          {
            participant,
            participants:
              updatedRoom.participants,
          }
        );
      }

      console.log(
        `${participant.username} disconnected from room ${roomId}`
      );
    }
  );
});

/* -------------------------------------------------------------------------- */
/*                                  SERVER                                   */
/* -------------------------------------------------------------------------- */

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed client origin: ${CLIENT_URL}`);
});