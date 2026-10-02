export interface CreateRoomPayload {
  username: string;
}

export interface JoinRoomPayload {
  roomId: string;
  username: string;
}