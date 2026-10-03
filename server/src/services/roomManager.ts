import { Room, Participant } from "../types/room";

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(roomId: string, host: Participant): Room {
    const room: Room = {
      roomId,
      videoId: "dQw4w9WgXcQ",
      isPlaying: false,
      currentTime: 0,
      lastUpdatedAt: Date.now(),
      participants: [host],
    };

    this.rooms.set(roomId, room);

    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  addParticipant(
    roomId: string,
    participant: Participant
  ): Room | undefined {
    const room = this.rooms.get(roomId);

    if (!room) {
      return undefined;
    }

    room.participants.push(participant);

    return room;
  }

  removeParticipant(
    roomId: string,
    userId: string
  ): Room | undefined {
    const room = this.rooms.get(roomId);

    if (!room) {
      return undefined;
    }

    room.participants = room.participants.filter(
      (participant) => participant.userId !== userId
    );

    return room;
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }
}