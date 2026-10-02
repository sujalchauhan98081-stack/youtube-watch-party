import assert from "node:assert/strict";
import test from "node:test";

import { RoomManager } from "./roomManager";

test("creates a room with the creator as host", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  const room = roomManager.createRoom("ABC123", host);

  assert.equal(room.roomId, "ABC123");
  assert.equal(room.videoId, null);
  assert.equal(room.isPlaying, false);
  assert.equal(room.currentTime, 0);
  assert.equal(room.participants.length, 1);
  assert.equal(room.participants[0].role, "host");
});

test("adds a participant to an existing room", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  const participant = {
    userId: "user-2",
    username: "Rahul",
    role: "participant" as const,
  };

  roomManager.createRoom("ABC123", host);

  const room = roomManager.addParticipant("ABC123", participant);

  assert.ok(room);
  assert.equal(room.participants.length, 2);
  assert.equal(room.participants[1].username, "Rahul");
});

test("returns undefined when adding to a non-existent room", () => {
  const roomManager = new RoomManager();

  const participant = {
    userId: "user-2",
    username: "Rahul",
    role: "participant" as const,
  };

  const room = roomManager.addParticipant("INVALID", participant);

  assert.equal(room, undefined);
});

test("removes a participant from a room", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  const participant = {
    userId: "user-2",
    username: "Rahul",
    role: "participant" as const,
  };

  roomManager.createRoom("ABC123", host);
  roomManager.addParticipant("ABC123", participant);

  const room = roomManager.removeParticipant("ABC123", "user-2");

  assert.ok(room);
  assert.equal(room.participants.length, 1);
  assert.equal(room.participants[0].userId, "user-1");
});