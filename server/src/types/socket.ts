import type { Role } from "./room.js";

export interface CreateRoomPayload {
  username: string;
}

export interface JoinRoomPayload {
  roomId: string;
  username: string;
}

export interface PlaybackPayload {
  roomId: string;
  currentTime: number;
}

export interface ChangeVideoPayload {
  roomId: string;
  videoId: string;
}

export interface AssignRolePayload {
  roomId: string;
  userId: string;
  role: Role;
}

export interface RemoveParticipantPayload {
  roomId: string;
  userId: string;
}

export interface SendChatMessagePayload {
  roomId: string;
  text: string;
}

export interface DeleteChatMessagePayload {
  roomId: string;
  messageId: string;
}

export interface TransferHostPayload {
  roomId: string;
  userId: string;
}
