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