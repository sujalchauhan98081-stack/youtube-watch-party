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
  assert.strictEqual(room.videoId, "dQw4w9WgXcQ");
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

  const room = roomManager.addParticipant(
    "ABC123",
    participant
  );

  assert.ok(room);
  assert.equal(room.participants.length, 2);
  assert.equal(room.participants[1].username, "Rahul");
  assert.equal(room.participants[1].role, "participant");
});

test("returns undefined when adding to a non-existent room", () => {
  const roomManager = new RoomManager();

  const participant = {
    userId: "user-2",
    username: "Rahul",
    role: "participant" as const,
  };

  const room = roomManager.addParticipant(
    "INVALID",
    participant
  );

  assert.equal(room, undefined);
});

test("gets a participant by user id", () => {
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

  const foundParticipant =
    roomManager.getParticipant(
      "ABC123",
      "user-2"
    );

  assert.ok(foundParticipant);
  assert.equal(foundParticipant.userId, "user-2");
  assert.equal(foundParticipant.username, "Rahul");
  assert.equal(foundParticipant.role, "participant");
});

test("returns undefined when participant does not exist", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  roomManager.createRoom("ABC123", host);

  const participant =
    roomManager.getParticipant(
      "ABC123",
      "unknown-user"
    );

  assert.equal(participant, undefined);
});

test("updates a participant role", () => {
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

  const updatedParticipant =
    roomManager.updateParticipantRole(
      "ABC123",
      "user-2",
      "moderator"
    );

  assert.ok(updatedParticipant);
  assert.equal(
    updatedParticipant.role,
    "moderator"
  );

  const storedParticipant =
    roomManager.getParticipant(
      "ABC123",
      "user-2"
    );

  assert.ok(storedParticipant);
  assert.equal(
    storedParticipant.role,
    "moderator"
  );
});

test("returns undefined when updating a non-existent participant role", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  roomManager.createRoom("ABC123", host);

  const updatedParticipant =
    roomManager.updateParticipantRole(
      "ABC123",
      "unknown-user",
      "moderator"
    );

  assert.equal(updatedParticipant, undefined);
});

test("does not change the host role through participant role update", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  roomManager.createRoom("ABC123", host);

  const updatedParticipant =
    roomManager.updateParticipantRole(
      "ABC123",
      "user-1",
      "moderator"
    );

  assert.ok(updatedParticipant);

  /*
   * RoomManager itself performs the role update.
   * The server is responsible for preventing
   * attempts to change the host role.
   */
  assert.equal(
    updatedParticipant.role,
    "moderator"
  );
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
  roomManager.addParticipant(
    "ABC123",
    participant
  );

  const room = roomManager.removeParticipant(
    "ABC123",
    "user-2"
  );

  assert.ok(room);
  assert.equal(room.participants.length, 1);
  assert.equal(
    room.participants[0].userId,
    "user-1"
  );

  assert.equal(
    roomManager.getParticipant(
      "ABC123",
      "user-2"
    ),
    undefined
  );
});

test("returns undefined when removing a non-existent participant", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  roomManager.createRoom("ABC123", host);

  const room = roomManager.removeParticipant(
    "ABC123",
    "unknown-user"
  );

  assert.equal(room, undefined);
});

test("returns undefined when removing from a non-existent room", () => {
  const roomManager = new RoomManager();

  const room = roomManager.removeParticipant(
    "INVALID",
    "user-1"
  );

  assert.equal(room, undefined);
});

test("deletes an existing room", () => {
  const roomManager = new RoomManager();

  const host = {
    userId: "user-1",
    username: "Sujal",
    role: "host" as const,
  };

  roomManager.createRoom("ABC123", host);

  const deleted =
    roomManager.deleteRoom("ABC123");

  assert.equal(deleted, true);
  assert.equal(
    roomManager.getRoom("ABC123"),
    undefined
  );
});

test("returns false when deleting a non-existent room", () => {
  const roomManager = new RoomManager();

  const deleted =
    roomManager.deleteRoom("INVALID");

  assert.equal(deleted, false);
});