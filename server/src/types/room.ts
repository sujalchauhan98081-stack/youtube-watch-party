export type Role = "host" | "moderator" | "participant";

export interface Participant {
  userId: string;
  username: string;
  role: Role;
}

export interface Room {
  roomId: string;
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedAt: number;
  participants: Participant[];
}