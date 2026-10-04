import { useCallback, useEffect, useRef, useState } from "react";

import YouTubePlayer from "./components/YouTubePlayer";

import type { YouTubePlayerHandle } from "./components/YouTubePlayer";

import { socket } from "./lib/socket";

type Role = "host" | "moderator" | "participant";

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

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: number;
}

function App() {
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const [connected, setConnected] = useState(false);

  const [serverMessage, setServerMessage] = useState("");

  const [actionPending, setActionPending] = useState<string | null>(null);

  const [roomId, setRoomId] = useState("");

  const [joinRoomId, setJoinRoomId] = useState("");

  const [username, setUsername] = useState("");

  const [videoId, setVideoId] = useState("dQw4w9WgXcQ");

  const [videoInput, setVideoInput] = useState("");

  const [syncState, setSyncState] = useState<SyncState | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");

  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [chatInput, setChatInput] = useState("");

  const canControl = currentRole === "host" || currentRole === "moderator";

  const isHost = currentRole === "host";

  /* ---------------------------------------------------------------------- */
  /*                            ROOM HELPERS                                */
  /* ---------------------------------------------------------------------- */

  const updateRoomParticipants = useCallback(
    (roomParticipants: Participant[]) => {
      setParticipants(roomParticipants);

      const currentUser = roomParticipants.find(
        (participant) => participant.userId === socket.id,
      );

      if (currentUser) {
        setCurrentUserId(currentUser.userId);

        setCurrentRole(currentUser.role);
      }
    },
    [],
  );

  const applyRoom = useCallback(
    (room: Room) => {
      setRoomId(room.roomId);

      if (room.videoId) {
        setVideoId(room.videoId);
      }

      updateRoomParticipants(room.participants);
    },
    [updateRoomParticipants],
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

      setCurrentUserId(socket.id ?? "");

      setServerMessage("Connected to server");

      setActionPending(null);
    };

    const handleDisconnect = () => {
      setConnected(false);

      setServerMessage("Disconnected from server");

      setActionPending(null);
    };

    const handleServerReady = (data: { message: string }) => {
      setServerMessage(data.message);

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                         ROOM CREATED                              */
    /* ------------------------------------------------------------------ */

    const handleRoomCreated = (data: {
      roomId: string;
      role: Role;
      room: Room;
    }) => {
      setRoomId(data.roomId);

      setCurrentRole(data.role);

      setCurrentUserId(socket.id ?? "");

      applyRoom(data.room);

      setSyncState({
        currentTime: data.room.currentTime,
        isPlaying: data.room.isPlaying,
      });

      setServerMessage(`Room ${data.roomId} created successfully`);

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                          ROOM JOINED                               */
    /* ------------------------------------------------------------------ */

    const handleRoomJoined = (data: {
      roomId: string;
      role: Role;
      room: Room;
    }) => {
      setRoomId(data.roomId);

      setCurrentRole(data.role);

      setCurrentUserId(socket.id ?? "");

      applyRoom(data.room);

      setServerMessage(`Joined room ${data.roomId}`);

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                            ROOM ERROR                              */
    /* ------------------------------------------------------------------ */

    const handleRoomError = (data: { message: string }) => {
      setServerMessage(data.message);
    };

    /* ------------------------------------------------------------------ */
    /*                           USER JOINED                              */
    /* ------------------------------------------------------------------ */

    const handleUserJoined = (data: { participant: Participant }) => {
      setParticipants((previous) => {
        const alreadyExists = previous.some(
          (participant) => participant.userId === data.participant.userId,
        );

        if (alreadyExists) {
          return previous;
        }

        return [...previous, data.participant];
      });

      setServerMessage(`${data.participant.username} joined the room`);

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                         ROLE ASSIGNED                              */
    /* ------------------------------------------------------------------ */

    const handleRoleAssigned = (data: {
      userId: string;
      username: string;
      role: Role;
      participants: Participant[];
    }) => {
      updateRoomParticipants(data.participants);

      if (data.userId === socket.id) {
        setCurrentRole(data.role);

        setServerMessage(`Your role is now ${data.role}`);

        setActionPending(null);
      } else {
        setServerMessage(`${data.username} is now ${data.role}`);

        setActionPending(null);
      }
    };

    /* ------------------------------------------------------------------ */
    /*                         HOST TRANSFER                              */
    /* ------------------------------------------------------------------ */

    const handleHostTransferred = (data: {
      previousHostId: string;
      newHostId: string;
      newHostUsername?: string;
      participants: Participant[];
      reason?: string;
    }) => {
      updateRoomParticipants(data.participants);

      if (data.newHostId === socket.id) {
        setCurrentRole("host");

        setServerMessage("You are now the host.");
      } else if (data.previousHostId === socket.id) {
        setCurrentRole("moderator");

        setServerMessage("You transferred host to another participant.");
      } else if (data.reason === "Host disconnected") {
        setServerMessage(
          `${data.newHostUsername ?? "A moderator"} is now the host.`,
        );
      } else {
        setServerMessage(
          `${data.newHostUsername ?? "Another participant"} is now the host.`,
        );
      }

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                       PARTICIPANT REMOVED                          */
    /* ------------------------------------------------------------------ */

    const handleParticipantRemoved = (data: {
      userId: string;
      participants?: Participant[];
      message?: string;
    }) => {
      if (data.userId === socket.id) {
        setRoomId("");

        setCurrentRole(null);

        setParticipants([]);

        setSyncState(null);

        setServerMessage(data.message ?? "You were removed from the room");

        setActionPending(null);

        return;
      }

      if (data.participants) {
        updateRoomParticipants(data.participants);
      } else {
        setParticipants((previous) =>
          previous.filter((participant) => participant.userId !== data.userId),
        );
      }

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                            USER LEFT                               */
    /* ------------------------------------------------------------------ */

    const handleUserLeft = (data: {
      participant: Participant;
      participants: Participant[];
    }) => {
      updateRoomParticipants(data.participants);

      setServerMessage(`${data.participant.username} left the room`);

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                                CHAT                                */
    /* ------------------------------------------------------------------ */

    const handleChatHistory = (data: { messages: ChatMessage[] }) => {
      setChatMessages((data.messages ?? []).slice(-100));
    };

    const handleChatMessage = (message: ChatMessage) => {
      setChatMessages((previous) => [...previous, message].slice(-100));
    };

    const handleChatMessageDeleted = (data: { messageId: string }) => {
      setChatMessages((previous) =>
        previous.filter((message) => message.id !== data.messageId),
      );
    };

    /* ------------------------------------------------------------------ */
    /*                          REMOTE PLAY                               */
    /* ------------------------------------------------------------------ */

    const handlePlay = (data: { currentTime: number }) => {
      playerRef.current?.playFromRemote();

      playerRef.current?.seekFromRemote(data.currentTime);
    };

    /* ------------------------------------------------------------------ */
    /*                          REMOTE PAUSE                              */
    /* ------------------------------------------------------------------ */

    const handlePause = (data: { currentTime: number }) => {
      playerRef.current?.pauseFromRemote();

      playerRef.current?.seekFromRemote(data.currentTime);
    };

    /* ------------------------------------------------------------------ */
    /*                           REMOTE SEEK                               */
    /* ------------------------------------------------------------------ */

    const handleSeek = (data: { currentTime: number }) => {
      playerRef.current?.seekFromRemote(data.currentTime);
    };

    /* ------------------------------------------------------------------ */
    /*                         VIDEO CHANGED                               */
    /* ------------------------------------------------------------------ */

    const handleVideoChanged = (data: { videoId: string }) => {
      setSyncState(null);

      setVideoId(data.videoId);

      setServerMessage(`Video changed to ${data.videoId}`);

      setActionPending(null);
    };

    /* ------------------------------------------------------------------ */
    /*                         SYNC STATE                                 */
    /* ------------------------------------------------------------------ */

    const handleSyncState = (data: {
      videoId: string | null;
      currentTime: number;
      isPlaying: boolean;
    }) => {
      if (!data.videoId) {
        return;
      }

      setVideoId(data.videoId);

      setSyncState({
        currentTime: data.currentTime,
        isPlaying: data.isPlaying,
      });
    };

    socket.on("connect", handleConnect);

    socket.on("disconnect", handleDisconnect);

    socket.on("server:ready", handleServerReady);

    socket.on("room_created", handleRoomCreated);

    socket.on("room_joined", handleRoomJoined);

    socket.on("room_error", handleRoomError);

    socket.on("user_joined", handleUserJoined);

    socket.on("role_assigned", handleRoleAssigned);
    socket.on("host_transferred", handleHostTransferred);

    socket.on("participant_removed", handleParticipantRemoved);

    socket.on("user_left", handleUserLeft);

    socket.on("play", handlePlay);

    socket.on("pause", handlePause);

    socket.on("seek", handleSeek);

    socket.on("video_changed", handleVideoChanged);

    socket.on("sync_state", handleSyncState);

    socket.on("chat_history", handleChatHistory);

    socket.on("chat_message", handleChatMessage);

    socket.on("chat_message_deleted", handleChatMessageDeleted);

    return () => {
      socket.off("connect", handleConnect);

      socket.off("disconnect", handleDisconnect);

      socket.off("server:ready", handleServerReady);

      socket.off("room_created", handleRoomCreated);

      socket.off("room_joined", handleRoomJoined);

      socket.off("room_error", handleRoomError);

      socket.off("user_joined", handleUserJoined);

      socket.off("role_assigned", handleRoleAssigned);
      socket.off("host_transferred", handleHostTransferred);

      socket.off("participant_removed", handleParticipantRemoved);

      socket.off("user_left", handleUserLeft);

      socket.off("play", handlePlay);

      socket.off("pause", handlePause);

      socket.off("seek", handleSeek);

      socket.off("video_changed", handleVideoChanged);

      socket.off("sync_state", handleSyncState);

      socket.off("chat_history", handleChatHistory);

      socket.off("chat_message", handleChatMessage);

      socket.off("chat_message_deleted", handleChatMessageDeleted);
    };
  }, [applyRoom, updateRoomParticipants]);

  /* ---------------------------------------------------------------------- */
  /*                           CREATE ROOM                                  */
  /* ---------------------------------------------------------------------- */

  const createRoom = () => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setServerMessage("Please enter your username");

      return;
    }

    setActionPending("create");

    socket.emit("create_room", {
      username: trimmedUsername,
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                            JOIN ROOM                                   */
  /* ---------------------------------------------------------------------- */

  const joinRoom = () => {
    const trimmedRoomId = joinRoomId.trim().toUpperCase();

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setServerMessage("Please enter your username");

      return;
    }

    if (!trimmedRoomId) {
      setServerMessage("Please enter a room ID");

      return;
    }

    setActionPending("join");

    socket.emit("join_room", {
      roomId: trimmedRoomId,
      username: trimmedUsername,
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                         LOCAL PLAY                                    */
  /* ---------------------------------------------------------------------- */

  const handlePlay = () => {
    if (!canControl) {
      setServerMessage("You do not have permission to play the video");

      return;
    }

    if (!roomId) {
      return;
    }

    const currentTime = playerRef.current?.getCurrentTime() ?? 0;

    socket.emit("play", {
      roomId,
      currentTime,
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                         LOCAL PAUSE                                   */
  /* ---------------------------------------------------------------------- */

  const handlePause = () => {
    if (!canControl) {
      setServerMessage("You do not have permission to pause the video");

      return;
    }

    if (!roomId) {
      return;
    }

    const currentTime = playerRef.current?.getCurrentTime() ?? 0;

    socket.emit("pause", {
      roomId,
      currentTime,
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                           LOCAL SEEK                                   */
  /* ---------------------------------------------------------------------- */

  const handleSeek = (currentTime: number) => {
    if (!canControl) {
      return;
    }

    if (!roomId) {
      return;
    }

    socket.emit("seek", {
      roomId,
      currentTime,
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                         CHANGE VIDEO                                  */
  /* ---------------------------------------------------------------------- */

  const changeVideo = () => {
    if (!canControl) {
      setServerMessage("You do not have permission to change the video");

      return;
    }

    const trimmedVideoId = videoInput.trim();

    if (!roomId) {
      setServerMessage("Join a room first");

      return;
    }

    if (!trimmedVideoId) {
      setServerMessage("Please enter a YouTube video ID");

      return;
    }

    setActionPending("change-video");

    socket.emit("change_video", {
      roomId,
      videoId: trimmedVideoId,
    });

    setVideoInput("");
  };

  /* ---------------------------------------------------------------------- */
  /*                         ASSIGN MODERATOR                              */
  /* ---------------------------------------------------------------------- */

  const assignModerator = (userId: string) => {
    if (!isHost) {
      return;
    }

    setActionPending("role");

    socket.emit("assign_role", {
      roomId,
      userId,
      role: "moderator",
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                         TRANSFER HOST                                  */
  /* ---------------------------------------------------------------------- */

  const transferHost = (userId: string) => {
    if (!isHost) {
      setServerMessage("Only the host can transfer host role");

      return;
    }

    if (!roomId) {
      return;
    }

    setActionPending(`transfer-host-${userId}`);

    socket.emit("transfer_host", {
      roomId,
      userId,
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                         REMOVE PARTICIPANT                            */
  /* ---------------------------------------------------------------------- */

  const removeParticipant = (userId: string) => {
    if (!isHost) {
      return;
    }

    if (!window.confirm("Remove this participant from the room?")) {
      return;
    }

    setActionPending("remove");

    socket.emit("remove_participant", {
      roomId,
      userId,
    });
  };

  const copyRoomId = async () => {
    if (!roomId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomId);
      setServerMessage("Room ID copied to clipboard");
    } catch {
      setServerMessage("Unable to copy room ID");
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                              CHAT                                     */
  /* ---------------------------------------------------------------------- */

  const sendChatMessage = () => {
    const text = chatInput.trim();

    if (!roomId || !connected || !text) {
      return;
    }

    socket.emit("send_chat_message", {
      roomId,
      text,
    });

    setChatInput("");
  };

  const deleteChatMessage = (messageId: string) => {
    if (!isHost || !roomId || !connected) {
      return;
    }

    socket.emit("delete_chat_message", {
      roomId,
      messageId,
    });
  };

  /* ---------------------------------------------------------------------- */
  /*                         LEAVE ROOM                                    */
  /* ---------------------------------------------------------------------- */

  const leaveRoom = () => {
    if (!roomId) {
      return;
    }

    setActionPending("leave");

    socket.emit("leave_room", {
      roomId,
    });

    setRoomId("");

    setCurrentRole(null);

    setParticipants([]);

    setChatMessages([]);
    setChatInput("");

    setSyncState(null);

    setServerMessage("You left the room");
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
                Real-time synchronized YouTube watching
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
                  connected ? "bg-emerald-400" : "bg-red-400"
                }`}
              />

              {connected ? "Connected" : "Disconnected"}
            </div>
          </div>
        </header>

        {/* LANDING PAGE */}

{!roomId && (
  <main>
    {/* HERO */}
    <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/30 px-6 py-14 text-center sm:px-10 sm:py-20">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-300">
          <span>●</span>
          Real-time YouTube Watch Party
        </div>

        <h2 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
          Watch YouTube together.
          <span className="block text-blue-400">
            From anywhere.
          </span>
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
          Create a room, invite your friends, and enjoy synchronized
          YouTube playback in real time. Everyone stays on the same
          video, at the same moment.
        </p>
      </div>
    </section>

    {/* CREATE / JOIN */}
    <section className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-2">

      {/* CREATE ROOM */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/30">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl">
          🚀
        </div>

        <h2 className="text-xl font-semibold">
          Create a Room
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Start a new watch party and become the Host.
          You can control playback and manage participants.
        </p>

        <div className="mt-6 space-y-3">
          <input
            type="text"
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="Your username"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          />

          <button
            onClick={createRoom}
            disabled={!connected}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionPending === "create"
              ? "Creating..."
              : "Create Room"}
          </button>
        </div>
      </div>

      {/* JOIN ROOM */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-purple-500/30">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-2xl">
          👥
        </div>

        <h2 className="text-xl font-semibold">
          Join a Room
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Enter a room ID and join an existing watch party
          as a Participant.
        </p>

        <div className="mt-6 space-y-3">
          <input
            type="text"
            value={joinRoomId}
            onChange={(event) =>
              setJoinRoomId(event.target.value)
            }
            placeholder="Room ID"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm uppercase outline-none transition focus:border-purple-500"
          />

          <button
            onClick={joinRoom}
            disabled={!connected}
            className="w-full rounded-xl bg-slate-700 px-4 py-3 font-medium transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionPending === "join"
              ? "Joining..."
              : "Join Room"}
          </button>
        </div>
      </div>

    </section>

    {/* FEATURES */}
    <section className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 text-2xl">⚡</div>

        <h3 className="font-semibold">
          Real-time Sync
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Play, pause and seek together with synchronized
          playback for everyone in the room.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 text-2xl">🛡️</div>

        <h3 className="font-semibold">
          Role Based Access
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Hosts and moderators control the experience while
          participants can simply sit back and watch.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 text-2xl">💬</div>

        <h3 className="font-semibold">
          Live Chat
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Chat with everyone in the room while watching
          your favorite YouTube videos.
        </p>
      </div>

    </section>

    {/* FOOTER TEXT */}
    <p className="mt-10 text-center text-xs text-slate-600">
      Create a room or join your friends and start watching together.
    </p>
  </main>
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
                  <span className="font-mono text-xl font-bold">{roomId}</span>

                  {currentRole && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                        currentRole === "host"
                          ? "bg-purple-500/15 text-purple-300"
                          : currentRole === "moderator"
                            ? "bg-blue-500/15 text-blue-300"
                            : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {currentRole}
                    </span>
                  )}

                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                    {canControl ? "Controller" : "Watch only"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyRoomId}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  Copy Room ID
                </button>

                <button
                  onClick={leaveRoom}
                  disabled={actionPending === "leave"}
                  className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionPending === "leave" ? "Leaving..." : "Leave Room"}
                </button>
              </div>
            </div>

            {!connected && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                Connection lost. Room controls are temporarily unavailable.
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* PLAYER */}

              <div className="space-y-6">
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
                  <YouTubePlayer
                    ref={playerRef}
                    videoId={videoId}
                    syncState={syncState}
                    canControl={canControl && connected}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeek={handleSeek}
                  />
                </div>

                {/* CHANGE VIDEO */}

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Change Video</h2>

                      <p className="text-xs text-slate-500">
                        Current: {videoId}
                      </p>
                    </div>

                    {(!canControl || !connected) && (
                      <span className="text-xs text-slate-500">
                        {!connected ? "Offline" : "Watch only"}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={videoInput}
                      onChange={(event) => setVideoInput(event.target.value)}
                      disabled={
                        !canControl || !connected || actionPending !== null
                      }
                      placeholder="YouTube video ID"
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <button
                      onClick={changeVideo}
                      disabled={
                        !canControl || !connected || actionPending !== null
                      }
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {actionPending === "change-video"
                        ? "Changing..."
                        : "Change Video"}
                    </button>
                  </div>
                </div>
              </div>

              {/* PARTICIPANTS */}

              <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Participants</h2>

                    <p className="text-xs text-slate-500">
                      {participants.length} member
                      {participants.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {participants.map((participant) => {
                    const isCurrentUser = participant.userId === currentUserId;

                    return (
                      <div
                        key={participant.userId}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {participant.username}

                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-slate-500">
                                  You
                                </span>
                              )}
                            </p>

                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                participant.role === "host"
                                  ? "bg-purple-500/15 text-purple-300"
                                  : participant.role === "moderator"
                                    ? "bg-blue-500/15 text-blue-300"
                                    : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {participant.role}
                            </span>
                          </div>
                        </div>

                        {/* HOST CONTROLS */}

                        {isHost &&
                          participant.role !== "host" &&
                          !isCurrentUser && (
                            <div className="mt-3 flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => transferHost(participant.userId)}
                                disabled={!connected || actionPending !== null}
                                className="w-full rounded-lg bg-amber-500/15 px-2 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {actionPending ===
                                `transfer-host-${participant.userId}`
                                  ? "Transferring..."
                                  : "Transfer Host"}
                              </button>

                              {participant.role !== "moderator" && (
                                <button
                                  onClick={() =>
                                    assignModerator(participant.userId)
                                  }
                                  disabled={
                                    !connected || actionPending !== null
                                  }
                                  className="w-full rounded-lg bg-blue-600/15 px-2 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {actionPending === "role"
                                    ? "Updating..."
                                    : "Make Moderator"}
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  removeParticipant(participant.userId)
                                }
                                disabled={!connected || actionPending !== null}
                                className="w-full rounded-lg bg-red-500/10 px-2 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {actionPending === "remove"
                                  ? "Removing..."
                                  : "Remove"}
                              </button>
                            </div>
                          )}
                      </div>
                    );
                  })}

                  {participants.length === 0 && (
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
                      <span className="font-medium text-purple-300">Host:</span>{" "}
                      Full controls + participant management
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

                  {/* CHAT */}

                  <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold">Room Chat</h2>
                        <p className="text-xs text-slate-500">
                          Everyone can chat
                        </p>
                      </div>

                      {isHost && (
                        <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-purple-300">
                          Host moderation
                        </span>
                      )}
                    </div>

                    <div className="h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-3">
                      {chatMessages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-center text-xs text-slate-500">
                          No messages yet.
                          <br />
                          Start the conversation.
                        </div>
                      ) : (
                        chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-lg border border-slate-800 bg-slate-950 p-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-xs font-semibold text-slate-300">
                                    {message.username}
                                  </span>

                                  {participants.find(
                                    (participant) =>
                                      participant.userId === message.userId,
                                  )?.role === "host" && (
                                    <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-purple-300">
                                      Host
                                    </span>
                                  )}
                                </div>

                                <p className="mt-1 break-words text-sm text-slate-200">
                                  {message.text}
                                </p>
                              </div>

                              {isHost && (
                                <button
                                  type="button"
                                  onClick={() => deleteChatMessage(message.id)}
                                  className="shrink-0 rounded px-1.5 py-1 text-[10px] text-red-400 hover:bg-red-500/10"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        maxLength={500}
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        disabled={!connected}
                        placeholder="Type a message..."
                        className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                      />

                      <button
                        type="button"
                        onClick={sendChatMessage}
                        disabled={!connected || !chatInput.trim()}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Send
                      </button>
                    </div>

                    <p className="mt-2 text-[10px] text-slate-600">
                      Maximum 500 characters
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
