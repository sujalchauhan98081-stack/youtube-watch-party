import {
  Participant,
  Role,
  Room,
} from "../types/room.js";

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(
    roomId: string,
    host: Participant
  ): Room {
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

  getParticipant(
    roomId: string,
    userId: string
  ): Participant | undefined {
    const room = this.rooms.get(roomId);

    if (!room) {
      return undefined;
    }

    return room.participants.find(
      (participant) =>
        participant.userId === userId
    );
  }

  updateParticipantRole(
    roomId: string,
    userId: string,
    role: Role
  ): Participant | undefined {
    const participant =
      this.getParticipant(
        roomId,
        userId
      );

    if (!participant) {
      return undefined;
    }

    participant.role = role;

    return participant;
  }

  transferHost(
    roomId: string,
    currentHostId: string,
    newHostId: string
  ): Room | undefined {
    const room = this.rooms.get(roomId);

    if (!room) {
      return undefined;
    }

    const currentHost =
      room.participants.find(
        (participant) =>
          participant.userId === currentHostId &&
          participant.role === "host"
      );

    const newHost =
      room.participants.find(
        (participant) =>
          participant.userId === newHostId
      );

    if (!currentHost || !newHost) {
      return undefined;
    }

    if (currentHost.userId === newHost.userId) {
      return undefined;
    }

    currentHost.role = "moderator";
    newHost.role = "host";

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

    const participantIndex =
      room.participants.findIndex(
        (participant) =>
          participant.userId === userId
      );

    if (participantIndex === -1) {
      return undefined;
    }

    room.participants.splice(
      participantIndex,
      1
    );

    return room;
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }
}