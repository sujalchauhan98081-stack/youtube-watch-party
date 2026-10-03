import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import YouTubePlayer from "./components/YouTubePlayer";

import type {
  YouTubePlayerHandle,
} from "./components/YouTubePlayer";

import { socket } from "./lib/socket";

type Role =
  | "host"
  | "moderator"
  | "participant";

interface Participant {
  userId: string;
  username: string;
  role: Role;
}

interface Room {
  roomId: string;
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedAt: number;
  participants: Participant[];
}

interface SyncState {
  currentTime: number;
  isPlaying: boolean;
}

function App() {
  const playerRef =
    useRef<YouTubePlayerHandle>(null);

  const [connected, setConnected] =
    useState(false);

  const [serverMessage, setServerMessage] =
    useState("");

  const [roomId, setRoomId] =
    useState("");

  const [joinRoomId, setJoinRoomId] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [videoId, setVideoId] =
    useState("dQw4w9WgXcQ");

  const [videoInput, setVideoInput] =
    useState("");

  const [syncState, setSyncState] =
    useState<SyncState | null>(null);

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [currentRole, setCurrentRole] =
    useState<Role | null>(null);

  const [participants, setParticipants] =
    useState<Participant[]>([]);

  const canControl =
    currentRole === "host" ||
    currentRole === "moderator";

  const isHost =
    currentRole === "host";

  /* ---------------------------------------------------------------------- */
  /*                            ROOM HELPERS                                */
  /* ---------------------------------------------------------------------- */

  const updateRoomParticipants =
    useCallback(
      (
        roomParticipants: Participant[]
      ) => {
        setParticipants(
          roomParticipants
        );

        const currentUser =
          roomParticipants.find(
            (participant) =>
              participant.userId ===
              socket.id
          );

        if (currentUser) {
          setCurrentUserId(
            currentUser.userId
          );

          setCurrentRole(
            currentUser.role
          );
        }
      },
      []
    );

  const applyRoom = useCallback(
    (room: Room) => {
      setRoomId(room.roomId);

      if (room.videoId) {
        setVideoId(room.videoId);
      }

      updateRoomParticipants(
        room.participants
      );
    },
    [updateRoomParticipants]
  );

  /* ---------------------------------------------------------------------- */
  /*                         SOCKET CONNECTION                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      setConnected(true);

      setCurrentUserId(
        socket.id ?? ""
      );

      setServerMessage(
        "Connected to server"
      );
    };

    const handleDisconnect = () => {
      setConnected(false);

      setServerMessage(
        "Disconnected from server"
      );
    };

    const handleServerReady = (
      data: {
        message: string;
      }
    ) => {
      setServerMessage(
        data.message
      );
    };

    /* ------------------------------------------------------------------ */
    /*                         ROOM CREATED                              */
    /* ------------------------------------------------------------------ */

    const handleRoomCreated = (
      data: {
        roomId: string;
        role: Role;
        room: Room;
      }
    ) => {
      setRoomId(
        data.roomId
      );

      setCurrentRole(
        data.role
      );

      setCurrentUserId(
        socket.id ?? ""
      );

      applyRoom(data.room);

      setSyncState({
        currentTime:
          data.room.currentTime,
        isPlaying:
          data.room.isPlaying,
      });

      setServerMessage(
        `Room ${data.roomId} created successfully`
      );
    };

    /* ------------------------------------------------------------------ */
    /*                          ROOM JOINED                               */
    /* ------------------------------------------------------------------ */

    const handleRoomJoined = (
      data: {
        roomId: string;
        role: Role;
        room: Room;
      }
    ) => {
      setRoomId(
        data.roomId
      );

      setCurrentRole(
        data.role
      );

      setCurrentUserId(
        socket.id ?? ""
      );

      applyRoom(data.room);

      setServerMessage(
        `Joined room ${data.roomId}`
      );
    };

    /* ------------------------------------------------------------------ */
    /*                            ROOM ERROR                              */
    /* ------------------------------------------------------------------ */

    const handleRoomError = (
      data: {
        message: string;
      }
    ) => {
      setServerMessage(
        data.message
      );
    };

    /* ------------------------------------------------------------------ */
    /*                           USER JOINED                              */
    /* ------------------------------------------------------------------ */

    const handleUserJoined = (
      data: {
        participant: Participant;
      }
    ) => {
      setParticipants(
        (previous) => {
          const alreadyExists =
            previous.some(
              (participant) =>
                participant.userId ===
                data.participant.userId
            );

          if (alreadyExists) {
            return previous;
          }

          return [
            ...previous,
            data.participant,
          ];
        }
      );

      setServerMessage(
        `${data.participant.username} joined the room`
      );
    };

    /* ------------------------------------------------------------------ */
    /*                         ROLE ASSIGNED                              */
    /* ------------------------------------------------------------------ */

    const handleRoleAssigned = (
      data: {
        userId: string;
        username: string;
        role: Role;
        participants: Participant[];
      }
    ) => {
      updateRoomParticipants(
        data.participants
      );

      if (
        data.userId ===
        socket.id
      ) {
        setCurrentRole(
          data.role
        );

        setServerMessage(
          `Your role is now ${data.role}`
        );
      } else {
        setServerMessage(
          `${data.username} is now ${data.role}`
        );
      }
    };

    /* ------------------------------------------------------------------ */
    /*                       PARTICIPANT REMOVED                          */
    /* ------------------------------------------------------------------ */

    const handleParticipantRemoved = (
      data: {
        userId: string;
        participants?: Participant[];
        message?: string;
      }
    ) => {
      if (
        data.userId ===
        socket.id
      ) {
        setRoomId("");

        setCurrentRole(
          null
        );

        setParticipants([]);

        setSyncState(null);

        setServerMessage(
          data.message ??
            "You were removed from the room"
        );

        return;
      }

      if (data.participants) {
        updateRoomParticipants(
          data.participants
        );
      } else {
        setParticipants(
          (previous) =>
            previous.filter(
              (participant) =>
                participant.userId !==
                data.userId
            )
        );
      }
    };

    /* ------------------------------------------------------------------ */
    /*                            USER LEFT                               */
    /* ------------------------------------------------------------------ */

    const handleUserLeft = (
      data: {
        participant: Participant;
        participants: Participant[];
      }
    ) => {
      updateRoomParticipants(
        data.participants
      );

      setServerMessage(
        `${data.participant.username} left the room`
      );
    };

    /* ------------------------------------------------------------------ */
    /*                          REMOTE PLAY                               */
    /* ------------------------------------------------------------------ */

    const handlePlay = (
      data: {
        currentTime: number;
      }
    ) => {
      playerRef.current?.playFromRemote();

      playerRef.current?.seekFromRemote(
        data.currentTime
      );
    };

    /* ------------------------------------------------------------------ */
    /*                          REMOTE PAUSE                              */
    /* ------------------------------------------------------------------ */

    const handlePause = (
      data: {
        currentTime: number;
      }
    ) => {
      playerRef.current?.pauseFromRemote();

      playerRef.current?.seekFromRemote(
        data.currentTime
      );
    };

    /* ------------------------------------------------------------------ */
    /*                           REMOTE SEEK                               */
    /* ------------------------------------------------------------------ */

    const handleSeek = (
      data: {
        currentTime: number;
      }
    ) => {
      playerRef.current?.seekFromRemote(
        data.currentTime
      );
    };

    /* ------------------------------------------------------------------ */
    /*                         VIDEO CHANGED                               */
    /* ------------------------------------------------------------------ */

    const handleVideoChanged = (
      data: {
        videoId: string;
      }
    ) => {
      setSyncState(null);

      setVideoId(
        data.videoId
      );

      setServerMessage(
        `Video changed to ${data.videoId}`
      );
    };

    /* ------------------------------------------------------------------ */
    /*                         SYNC STATE                                 */
    /* ------------------------------------------------------------------ */

    const handleSyncState = (
      data: {
        videoId: string | null;
        currentTime: number;
        isPlaying: boolean;
      }
    ) => {
      if (!data.videoId) {
        return;
      }

      setVideoId(
        data.videoId
      );

      setSyncState({
        currentTime:
          data.currentTime,
        isPlaying:
          data.isPlaying,
      });
    };

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "server:ready",
      handleServerReady
    );

    socket.on(
      "room_created",
      handleRoomCreated
    );

    socket.on(
      "room_joined",
      handleRoomJoined
    );

    socket.on(
      "room_error",
      handleRoomError
    );

    socket.on(
      "user_joined",
      handleUserJoined
    );

    socket.on(
      "role_assigned",
      handleRoleAssigned
    );

    socket.on(
      "participant_removed",
      handleParticipantRemoved
    );

    socket.on(
      "user_left",
      handleUserLeft
    );

    socket.on(
      "play",
      handlePlay
    );

    socket.on(
      "pause",
      handlePause
    );

    socket.on(
      "seek",
      handleSeek
    );

    socket.on(
      "video_changed",
      handleVideoChanged
    );

    socket.on(
      "sync_state",
      handleSyncState
    );

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "server:ready",
        handleServerReady
      );

      socket.off(
        "room_created",
        handleRoomCreated
      );

      socket.off(
        "room_joined",
        handleRoomJoined
      );

      socket.off(
        "room_error",
        handleRoomError
      );

      socket.off(
        "user_joined",
        handleUserJoined
      );

      socket.off(
        "role_assigned",
        handleRoleAssigned
      );

      socket.off(
        "participant_removed",
        handleParticipantRemoved
      );

      socket.off(
        "user_left",
        handleUserLeft
      );

      socket.off(
        "play",
        handlePlay
      );

      socket.off(
        "pause",
        handlePause
      );

      socket.off(
        "seek",
        handleSeek
      );

      socket.off(
        "video_changed",
        handleVideoChanged
      );

      socket.off(
        "sync_state",
        handleSyncState
      );
    };
  }, [
    applyRoom,
    updateRoomParticipants,
  ]);

  /* ---------------------------------------------------------------------- */
  /*                           CREATE ROOM                                  */
  /* ---------------------------------------------------------------------- */

  const createRoom = () => {
    const trimmedUsername =
      username.trim();

    if (!trimmedUsername) {
      setServerMessage(
        "Please enter your username"
      );

      return;
    }

    socket.emit(
      "create_room",
      {
        username:
          trimmedUsername,
      }
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                            JOIN ROOM                                   */
  /* ---------------------------------------------------------------------- */

  const joinRoom = () => {
    const trimmedRoomId =
      joinRoomId
        .trim()
        .toUpperCase();

    const trimmedUsername =
      username.trim();

    if (!trimmedUsername) {
      setServerMessage(
        "Please enter your username"
      );

      return;
    }

    if (!trimmedRoomId) {
      setServerMessage(
        "Please enter a room ID"
      );

      return;
    }

    socket.emit(
      "join_room",
      {
        roomId:
          trimmedRoomId,
        username:
          trimmedUsername,
      }
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                         LOCAL PLAY                                    */
  /* ---------------------------------------------------------------------- */

  const handlePlay = () => {
    if (!canControl) {
      setServerMessage(
        "You do not have permission to play the video"
      );

      return;
    }

    if (!roomId) {
      return;
    }

    const currentTime =
      playerRef.current?.getCurrentTime() ??
      0;

    socket.emit(
      "play",
      {
        roomId,
        currentTime,
      }
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                         LOCAL PAUSE                                   */
  /* ---------------------------------------------------------------------- */

  const handlePause = () => {
    if (!canControl) {
      setServerMessage(
        "You do not have permission to pause the video"
      );

      return;
    }

    if (!roomId) {
      return;
    }

    const currentTime =
      playerRef.current?.getCurrentTime() ??
      0;

    socket.emit(
      "pause",
      {
        roomId,
        currentTime,
      }
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                           LOCAL SEEK                                   */
  /* ---------------------------------------------------------------------- */

  const handleSeek = (
    currentTime: number
  ) => {
    if (!canControl) {
      return;
    }

    if (!roomId) {
      return;
    }

    socket.emit(
      "seek",
      {
        roomId,
        currentTime,
      }
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                         CHANGE VIDEO                                  */
  /* ---------------------------------------------------------------------- */

  const changeVideo = () => {
    if (!canControl) {
      setServerMessage(
        "You do not have permission to change the video"
      );

      return;
    }

    const trimmedVideoId =
      videoInput.trim();

    if (!roomId) {
      setServerMessage(
        "Join a room first"
      );

      return;
    }

    if (!trimmedVideoId) {
      setServerMessage(
        "Please enter a YouTube video ID"
      );

      return;
    }

    socket.emit(
      "change_video",
      {
        roomId,
        videoId:
          trimmedVideoId,
      }
    );

    setVideoInput("");
  };

  /* ---------------------------------------------------------------------- */
  /*                         ASSIGN MODERATOR                              */
  /* ---------------------------------------------------------------------- */

  const assignModerator = (
    userId: string
  ) => {
    if (!isHost) {
      return;
    }

    socket.emit(
      "assign_role",
      {
        roomId,
        userId,
        role: "moderator",
      }
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                         REMOVE PARTICIPANT                            */
  /* ---------------------------------------------------------------------- */

  const removeParticipant = (
    userId: string
  ) => {
    if (!isHost) {
      return;
    }

    socket.emit(
      "remove_participant",
      {
        roomId,
        userId,
      }
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                         LEAVE ROOM                                    */
  /* ---------------------------------------------------------------------- */

  const leaveRoom = () => {
    if (!roomId) {
      return;
    }

    socket.emit(
      "leave_room",
      {
        roomId,
      }
    );

    setRoomId("");

    setCurrentRole(
      null
    );

    setParticipants([]);

    setSyncState(null);

    setServerMessage(
      "You left the room"
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                                UI                                      */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HEADER */}

        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                YouTube Watch Party
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Real-time synchronized YouTube
                watching
              </p>
            </div>

            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm ${
                connected
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected
                    ? "bg-emerald-400"
                    : "bg-red-400"
                }`}
              />

              {connected
                ? "Connected"
                : "Disconnected"}
            </div>
          </div>
        </header>

        {/* CREATE / JOIN */}

        {!roomId && (
          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Create a Room
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Create a new watch party as the
                Host.
              </p>

              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                    )
                  }
                  placeholder="Your username"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                />

                <button
                  onClick={createRoom}
                  disabled={!connected}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Room
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Join a Room
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Join an existing watch party as a
                Participant.
              </p>

              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(event) =>
                    setJoinRoomId(
                      event.target.value
                    )
                  }
                  placeholder="Room ID"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-500"
                />

                <button
                  onClick={joinRoom}
                  disabled={!connected}
                  className="w-full rounded-xl bg-slate-700 px-4 py-3 font-medium transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Join Room
                </button>
              </div>
            </div>
          </section>
        )}

        {/* MESSAGE */}

        {serverMessage && (
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            {serverMessage}
          </div>
        )}

        {/* ROOM */}

        {roomId && (
          <section>
            {/* ROOM HEADER */}

            <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Room
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xl font-bold">
                    {roomId}
                  </span>

                  {currentRole && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                        currentRole ===
                        "host"
                          ? "bg-purple-500/15 text-purple-300"
                          : currentRole ===
                            "moderator"
                          ? "bg-blue-500/15 text-blue-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {currentRole}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={leaveRoom}
                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
              >
                Leave Room
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* PLAYER */}

              <div className="space-y-6">
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
                  <YouTubePlayer
                    ref={playerRef}
                    videoId={videoId}
                    syncState={syncState}
                    canControl={canControl}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeek={handleSeek}
                  />
                </div>

                {/* CHANGE VIDEO */}

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">
                        Change Video
                      </h2>

                      <p className="text-xs text-slate-500">
                        Current:{" "}
                        {videoId}
                      </p>
                    </div>

                    {!canControl && (
                      <span className="text-xs text-slate-500">
                        Watch only
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={videoInput}
                      onChange={(event) =>
                        setVideoInput(
                          event.target.value
                        )
                      }
                      disabled={
                        !canControl
                      }
                      placeholder="YouTube video ID"
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <button
                      onClick={
                        changeVideo
                      }
                      disabled={
                        !canControl
                      }
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Change Video
                    </button>
                  </div>
                </div>
              </div>

              {/* PARTICIPANTS */}

              <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">
                      Participants
                    </h2>

                    <p className="text-xs text-slate-500">
                      {participants.length}{" "}
                      member
                      {participants.length !==
                      1
                        ? "s"
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {participants.map(
                    (participant) => {
                      const isCurrentUser =
                        participant.userId ===
                        currentUserId;

                      return (
                        <div
                          key={
                            participant.userId
                          }
                          className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {
                                  participant.username
                                }

                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-slate-500">
                                    You
                                  </span>
                                )}
                              </p>

                              <span
                                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  participant.role ===
                                  "host"
                                    ? "bg-purple-500/15 text-purple-300"
                                    : participant.role ===
                                      "moderator"
                                    ? "bg-blue-500/15 text-blue-300"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {
                                  participant.role
                                }
                              </span>
                            </div>
                          </div>

                          {/* HOST CONTROLS */}

                          {isHost &&
                            participant.role !==
                              "host" &&
                            !isCurrentUser && (
                              <div className="mt-3 flex gap-2">
                                {participant.role !==
                                  "moderator" && (
                                  <button
                                    onClick={() =>
                                      assignModerator(
                                        participant.userId
                                      )
                                    }
                                    className="flex-1 rounded-lg bg-blue-600/15 px-2 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-600/25"
                                  >
                                    Make Moderator
                                  </button>
                                )}

                                <button
                                  onClick={() =>
                                    removeParticipant(
                                      participant.userId
                                    )
                                  }
                                  className="flex-1 rounded-lg bg-red-500/10 px-2 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                        </div>
                      );
                    }
                  )}

                  {participants.length ===
                    0 && (
                    <p className="py-6 text-center text-sm text-slate-500">
                      No participants
                    </p>
                  )}
                </div>

                {/* PERMISSIONS */}

                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Permissions
                  </p>

                  <div className="mt-3 space-y-2 text-xs text-slate-400">
                    <p>
                      <span className="font-medium text-purple-300">
                        Host:
                      </span>{" "}
                      Full controls + participant
                      management
                    </p>

                    <p>
                      <span className="font-medium text-blue-300">
                        Moderator:
                      </span>{" "}
                      Playback + video controls
                    </p>

                    <p>
                      <span className="font-medium text-slate-300">
                        Participant:
                      </span>{" "}
                      Watch only
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;