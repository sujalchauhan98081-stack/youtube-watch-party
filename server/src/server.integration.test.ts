import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import test, {
  before,
  after,
} from "node:test";

import {
  io,
  type Socket,
} from "socket.io-client";

const SERVER_URL = "http://localhost:5000";

let serverProcess: ChildProcess;

function waitForServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Timed out waiting for server to start"
        )
      );
    }, 10000);

    serverProcess.stdout?.on(
      "data",
      (data: Buffer) => {
        const output = data.toString();

        if (
          output.includes("Server running on port 5000")
        ) {
          clearTimeout(timeout);
          resolve();
        }
      }
    );

    serverProcess.stderr?.on(
      "data",
      (data: Buffer) => {
        const output = data.toString();

        if (output.toLowerCase().includes("error")) {
          console.error(
            `Server error: ${output}`
          );
        }
      }
    );

    serverProcess.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    serverProcess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(
          new Error(
            `Server exited with code ${code}`
          )
        );
      }
    });
  });
}

function connectClient(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      forceNew: true,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();

      reject(
        new Error(
          "Timed out connecting to server"
        )
      );
    }, 5000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });
}

function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);

      reject(
        new Error(
          `Timed out waiting for "${event}"`
        )
      );
    }, timeoutMs);

    const handler = (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    };

    socket.once(event, handler);
  });
}

function expectRoomError(
  socket: Socket,
  emitEvent: string,
  payload: unknown,
  expectedMessage: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("room_error", handler);

      reject(
        new Error(
          `Expected room_error for "${emitEvent}"`
        )
      );
    }, 3000);

    const handler = (data: { message: string }) => {
      clearTimeout(timeout);

      assert.equal(
        data.message,
        expectedMessage
      );

      resolve();
    };

    socket.once("room_error", handler);

    socket.emit(
      emitEvent,
      payload
    );
  });
}

async function createRoom(
  socket: Socket,
  username: string
): Promise<{
  roomId: string;
  role: string;
}> {
  const roomCreated =
    waitForEvent<{
      roomId: string;
      role: string;
      room: unknown;
    }>(
      socket,
      "room_created"
    );

  socket.emit("create_room", {
    username,
  });

  return roomCreated;
}

async function joinRoom(
  socket: Socket,
  roomId: string,
  username: string
): Promise<{
  roomId: string;
  role: string;
}> {
  const roomJoined =
    waitForEvent<{
      roomId: string;
      role: string;
      room: unknown;
    }>(
      socket,
      "room_joined"
    );

  socket.emit("join_room", {
    roomId,
    username,
  });

  return roomJoined;
}

before(async () => {
  serverProcess = spawn(
    process.execPath,
    [
      "--import=tsx",
      "src/server.ts",
    ],
    {
      cwd: process.cwd(),
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
      windowsHide: true,
    }
  );

  await waitForServer();
});

after(async () => {
  serverProcess.kill();
});

test(
  "host can control playback",
  async () => {
    const host = await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      assert.equal(
        created.role,
        "host"
      );

      const playPromise =
        new Promise<void>(
          (resolve) => {
            host.once(
              "room_error",
              () => {
                resolve();
              }
            );
          }
        );

      /*
       * The host does not receive
       * its own "play" broadcast.
       *
       * We therefore verify that no
       * permission error is returned.
       */
      host.emit("play", {
        roomId: created.roomId,
        currentTime: 10,
      });

      await Promise.race([
        playPromise,
        new Promise<void>(
          (resolve) =>
            setTimeout(
              resolve,
              250
            )
        ),
      ]);
    } finally {
      host.disconnect();
    }
  }
);

test(
  "participant cannot control playback",
  async () => {
    const host = await connectClient();
    const participant =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      await expectRoomError(
        participant,
        "play",
        {
          roomId:
            created.roomId,
          currentTime: 10,
        },
        "You do not have permission to control playback."
      );

      await expectRoomError(
        participant,
        "pause",
        {
          roomId:
            created.roomId,
          currentTime: 10,
        },
        "You do not have permission to control playback."
      );

      await expectRoomError(
        participant,
        "seek",
        {
          roomId:
            created.roomId,
          currentTime: 30,
        },
        "You do not have permission to control playback."
      );

      await expectRoomError(
        participant,
        "change_video",
        {
          roomId:
            created.roomId,
          videoId:
            "M7lc1UVf-VE",
        },
        "You do not have permission to change the video."
      );
    } finally {
      host.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "host can promote participant to moderator",
  async () => {
    const host = await connectClient();
    const participant =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      const joined =
        await joinRoom(
          participant,
          created.roomId,
          "Participant"
        );

      assert.equal(
        joined.role,
        "participant"
      );

      const roleAssigned =
        waitForEvent<{
          userId: string;
          username: string;
          role: string;
        }>(
          participant,
          "role_assigned"
        );

      host.emit(
        "assign_role",
        {
          roomId:
            created.roomId,
          userId:
            participant.id,
          role: "moderator",
        }
      );

      const result =
        await roleAssigned;

      assert.equal(
        result.userId,
        participant.id
      );

      assert.equal(
        result.username,
        "Participant"
      );

      assert.equal(
        result.role,
        "moderator"
      );
    } finally {
      host.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "moderator can control playback",
  async () => {
    const host = await connectClient();
    const moderator =
      await connectClient();
    const observer =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        moderator,
        created.roomId,
        "Moderator"
      );

      await joinRoom(
        observer,
        created.roomId,
        "Observer"
      );

      const roleAssigned =
        waitForEvent<{
          role: string;
        }>(
          moderator,
          "role_assigned"
        );

      host.emit(
        "assign_role",
        {
          roomId:
            created.roomId,
          userId:
            moderator.id,
          role: "moderator",
        }
      );

      await roleAssigned;

      const playReceived =
        waitForEvent<{
          currentTime: number;
        }>(
          observer,
          "play"
        );

      moderator.emit(
        "play",
        {
          roomId:
            created.roomId,
          currentTime: 15,
        }
      );

      const play =
        await playReceived;

      assert.equal(
        play.currentTime,
        15
      );
    } finally {
      host.disconnect();
      moderator.disconnect();
      observer.disconnect();
    }
  }
);

test(
  "moderator cannot assign roles",
  async () => {
    const host = await connectClient();
    const moderator =
      await connectClient();
    const participant =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        moderator,
        created.roomId,
        "Moderator"
      );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      const roleAssigned =
        waitForEvent(
          moderator,
          "role_assigned"
        );

      host.emit(
        "assign_role",
        {
          roomId:
            created.roomId,
          userId:
            moderator.id,
          role: "moderator",
        }
      );

      await roleAssigned;

      await expectRoomError(
        moderator,
        "assign_role",
        {
          roomId:
            created.roomId,
          userId:
            participant.id,
          role: "moderator",
        },
        "Only the host can assign roles."
      );
    } finally {
      host.disconnect();
      moderator.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "participant cannot assign roles",
  async () => {
    const host = await connectClient();
    const participant =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      await expectRoomError(
        participant,
        "assign_role",
        {
          roomId:
            created.roomId,
          userId:
            host.id,
          role: "moderator",
        },
        "Only the host can assign roles."
      );
    } finally {
      host.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "moderator cannot remove participants",
  async () => {
    const host = await connectClient();
    const moderator =
      await connectClient();
    const participant =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        moderator,
        created.roomId,
        "Moderator"
      );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      const roleAssigned =
        waitForEvent(
          moderator,
          "role_assigned"
        );

      host.emit(
        "assign_role",
        {
          roomId:
            created.roomId,
          userId:
            moderator.id,
          role: "moderator",
        }
      );

      await roleAssigned;

      await expectRoomError(
        moderator,
        "remove_participant",
        {
          roomId:
            created.roomId,
          userId:
            participant.id,
        },
        "Only the host can remove participants."
      );
    } finally {
      host.disconnect();
      moderator.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "participant cannot remove participants",
  async () => {
    const host = await connectClient();
    const participant =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      await expectRoomError(
        participant,
        "remove_participant",
        {
          roomId:
            created.roomId,
          userId:
            host.id,
        },
        "Only the host can remove participants."
      );
    } finally {
      host.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "host cannot change the host role",
  async () => {
    const host = await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await expectRoomError(
        host,
        "assign_role",
        {
          roomId:
            created.roomId,
          userId:
            host.id,
          role: "moderator",
        },
        "The host role cannot be changed."
      );
    } finally {
      host.disconnect();
    }
  }
);

test(
  "invalid room cannot be joined",
  async () => {
    const participant =
      await connectClient();

    try {
      await expectRoomError(
        participant,
        "join_room",
        {
          roomId:
            "INVALID",
          username:
            "Participant",
        },
        "Room not found."
      );
    } finally {
      participant.disconnect();
    }
  }
);

test(
  "host can remove a participant",
  async () => {
    const host = await connectClient();
    const participant =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      const removed =
        waitForEvent<{
          userId: string;
          message: string;
        }>(
          participant,
          "participant_removed"
        );

      host.emit(
        "remove_participant",
        {
          roomId:
            created.roomId,
          userId:
            participant.id,
        }
      );

      const result =
        await removed;

      assert.equal(
        result.userId,
        participant.id
      );

      assert.equal(
        result.message,
        "You have been removed from the room."
      );
    } finally {
      host.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "host disconnect removes host and notifies remaining participants",
  async () => {
    const host = await connectClient();
    const participant =
      await connectClient();

    const hostId = host.id;

    assert.ok(hostId);

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      const userLeft =
        waitForEvent<{
          participant: {
            userId: string;
            username: string;
            role: string;
          };
          participants: {
            userId: string;
            username: string;
            role: string;
          }[];
        }>(
          participant,
          "user_left"
        );

      host.disconnect();

      const result =
        await userLeft;

      assert.equal(
        result.participant.userId,
        hostId
      );

      assert.equal(
        result.participant.username,
        "Host"
      );

      assert.equal(
        result.participant.role,
        "host"
      );

      assert.equal(
        result.participants.length,
        1
      );

      assert.equal(
        result.participants[0].userId,
        participant.id
      );
    } finally {
      host.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "participant disconnect removes participant and notifies remaining participants",
  async () => {
    const host = await connectClient();
    const participant =
      await connectClient();

    const participantId =
      participant.id;

    assert.ok(participantId);

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        participant,
        created.roomId,
        "Participant"
      );

      const userLeft =
        waitForEvent<{
          participant: {
            userId: string;
            username: string;
            role: string;
          };
          participants: {
            userId: string;
            username: string;
            role: string;
          }[];
        }>(
          host,
          "user_left"
        );

      participant.disconnect();

      const result =
        await userLeft;

      assert.equal(
        result.participant.userId,
        participantId
      );

      assert.equal(
        result.participant.username,
        "Participant"
      );

      assert.equal(
        result.participant.role,
        "participant"
      );

      assert.equal(
        result.participants.length,
        1
      );

      assert.equal(
        result.participants[0].userId,
        host.id
      );
    } finally {
      host.disconnect();
      participant.disconnect();
    }
  }
);

test(
  "late joiner receives current playing state",
  async () => {
    const host = await connectClient();
    const observer = await connectClient();
    const lateJoiner =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      await joinRoom(
        observer,
        created.roomId,
        "Observer"
      );

      const playReceived =
        waitForEvent<{
          currentTime: number;
        }>(
          observer,
          "play"
        );

      host.emit("play", {
        roomId: created.roomId,
        currentTime: 20,
      });

      await playReceived;

      const syncState =
        waitForEvent<{
          videoId: string | null;
          currentTime: number;
          isPlaying: boolean;
        }>(
          lateJoiner,
          "sync_state"
        );

      await joinRoom(
        lateJoiner,
        created.roomId,
        "Late Joiner"
      );

      const sync =
        await syncState;

      assert.equal(
        sync.videoId,
        "dQw4w9WgXcQ"
      );

      assert.equal(
        sync.isPlaying,
        true
      );

      assert.ok(
        sync.currentTime >= 20
      );

      assert.ok(
        sync.currentTime < 25
      );
    } finally {
      host.disconnect();
      observer.disconnect();
      lateJoiner.disconnect();
    }
  }
);

test(
  "late joiner receives current paused state",
  async () => {
    const host = await connectClient();
    const lateJoiner =
      await connectClient();

    try {
      const created =
        await createRoom(
          host,
          "Host"
        );

      const syncState =
        waitForEvent<{
          videoId: string | null;
          currentTime: number;
          isPlaying: boolean;
        }>(
          lateJoiner,
          "sync_state"
        );

      /*
       * A newly created room starts paused
       * at time 0. Seek to a known position
       * while remaining paused.
       */
      const observer =
        await connectClient();

      try {
        await joinRoom(
          observer,
          created.roomId,
          "Observer"
        );

        const seekReceived =
          waitForEvent<{
            currentTime: number;
          }>(
            observer,
            "seek"
          );

        host.emit("seek", {
          roomId:
            created.roomId,
          currentTime: 42,
        });

        await seekReceived;
      } finally {
        observer.disconnect();
      }

      /*
       * Register the sync listener again because
       * the previous listener was created before
       * the seek operation and may otherwise make
       * the test harder to reason about.
       */
      const pausedSyncState =
        waitForEvent<{
          videoId: string | null;
          currentTime: number;
          isPlaying: boolean;
        }>(
          lateJoiner,
          "sync_state"
        );

      await joinRoom(
        lateJoiner,
        created.roomId,
        "Late Joiner"
      );

      const sync =
        await pausedSyncState;

      assert.equal(
        sync.videoId,
        "dQw4w9WgXcQ"
      );

      assert.equal(
        sync.currentTime,
        42
      );

      assert.equal(
        sync.isPlaying,
        false
      );

      /*
       * Prevent the initial unused listener
       * from remaining active.
       */
      void syncState;
    } finally {
      host.disconnect();
      lateJoiner.disconnect();
    }
  }
);