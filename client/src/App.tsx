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

function App() {
  const playerRef =
    useRef<YouTubePlayerHandle | null>(null);

  const [connected, setConnected] =
    useState(false);

  const [serverMessage, setServerMessage] =
    useState("");

  const [roomId, setRoomId] =
    useState("");

  const [joinRoomId, setJoinRoomId] =
    useState("");

  useEffect(() => {
    const handleConnect = () => {
      console.log(
        "SOCKET CONNECTED:",
        socket.id
      );

      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log(
        "SOCKET DISCONNECTED"
      );

      setConnected(false);
    };

    const handleServerReady = (data: {
      message: string;
    }) => {
      console.log(
        "SERVER READY:",
        data.message
      );

      setServerMessage(data.message);
    };

    const handleRoomCreated = (data: {
      roomId: string;
      role: string;
    }) => {
      console.log(
        "ROOM CREATED:",
        data
      );

      setRoomId(data.roomId);

      setServerMessage(
        `Room created successfully as ${data.role}`
      );
    };

    const handleRoomJoined = (data: {
      roomId: string;
      role: string;
    }) => {
      console.log(
        "ROOM JOINED:",
        data
      );

      setRoomId(data.roomId);

      setServerMessage(
        `Joined room as ${data.role}`
      );
    };

    const handleRoomError = (data: {
      message: string;
    }) => {
      console.log(
        "ROOM ERROR:",
        data.message
      );

      setServerMessage(data.message);
    };

    const handleUserJoined = (data: {
      participant: {
        userId: string;
        username: string;
        role: string;
      };
    }) => {
      console.log(
        "USER JOINED:",
        data.participant
      );

      setServerMessage(
        `${data.participant.username} joined the room`
      );
    };

    /*
     * Another client pressed PLAY.
     */
    const handleRemotePlay = (data: {
      currentTime: number;
    }) => {
      console.log(
        "========== REMOTE PLAY =========="
      );

      console.log(
        "Remote time:",
        data.currentTime
      );

      if (!playerRef.current) {
        console.log(
          "Remote PLAY failed: player not ready"
        );

        return;
      }

      /*
       * First synchronize the time.
       */
      playerRef.current.seek(
        data.currentTime
      );

      /*
       * Then play without generating
       * another socket event.
       */
      playerRef.current.playFromRemote();
    };

    /*
     * Another client pressed PAUSE.
     */
    const handleRemotePause = (data: {
      currentTime: number;
    }) => {
      console.log(
        "========== REMOTE PAUSE =========="
      );

      console.log(
        "Remote time:",
        data.currentTime
      );

      if (!playerRef.current) {
        console.log(
          "Remote PAUSE failed: player not ready"
        );

        return;
      }

      /*
       * Synchronize the time first.
       */
      playerRef.current.seek(
        data.currentTime
      );

      /*
       * Then pause without generating
       * another socket event.
       */
      playerRef.current.pauseFromRemote();
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
      "play",
      handleRemotePlay
    );

    socket.on(
      "pause",
      handleRemotePause
    );

    if (!socket.connected) {
      socket.connect();
    }

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
        "play",
        handleRemotePlay
      );

      socket.off(
        "pause",
        handleRemotePause
      );

      socket.disconnect();
    };
  }, []);

  /*
   * LOCAL YOUTUBE PLAY
   */
  const handleLocalPlay =
    useCallback(() => {
      if (!roomId) {
        console.log(
          "PLAY ignored: no room"
        );

        return;
      }

      const currentTime =
        playerRef.current?.getCurrentTime() ??
        0;

      console.log(
        "========== LOCAL PLAY =========="
      );

      console.log(
        "Room:",
        roomId
      );

      console.log(
        "Time:",
        currentTime
      );

      console.log(
        "Socket:",
        socket.id
      );

      socket.emit("play", {
        roomId,
        currentTime,
      });
    }, [roomId]);

  /*
   * LOCAL YOUTUBE PAUSE
   */
  const handleLocalPause =
    useCallback(() => {
      if (!roomId) {
        console.log(
          "PAUSE ignored: no room"
        );

        return;
      }

      const currentTime =
        playerRef.current?.getCurrentTime() ??
        0;

      console.log(
        "========== LOCAL PAUSE =========="
      );

      console.log(
        "Room:",
        roomId
      );

      console.log(
        "Time:",
        currentTime
      );

      console.log(
        "Socket:",
        socket.id
      );

      socket.emit("pause", {
        roomId,
        currentTime,
      });
    }, [roomId]);

  const createRoom = () => {
    console.log(
      "CREATE ROOM REQUEST"
    );

    socket.emit("create_room", {
      username: "Sujal",
    });
  };

  const joinRoom = () => {
    if (!joinRoomId.trim()) {
      setServerMessage(
        "Please enter a room ID"
      );

      return;
    }

    const room =
      joinRoomId
        .trim()
        .toUpperCase();

    console.log(
      "JOIN ROOM REQUEST:",
      room
    );

    socket.emit("join_room", {
      roomId: room,
      username: "Rahul",
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        <div className="text-center">
          <h1 className="text-4xl font-bold">
            YouTube Watch Party
          </h1>

          <p className="mt-3 text-slate-400">
            Real-time watch party application
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-slate-900 p-6">

          <div className="text-center">

            <p className="text-lg">
              Socket status:{" "}

              <span
                className={
                  connected
                    ? "font-semibold text-green-400"
                    : "font-semibold text-red-400"
                }
              >
                {connected
                  ? "Connected"
                  : "Disconnected"}
              </span>
            </p>

            {serverMessage && (
              <p className="mt-3 text-sm text-slate-300">
                {serverMessage}
              </p>
            )}

          </div>

          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">

            <button
              onClick={createRoom}
              disabled={!connected}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Room
            </button>

            <div className="flex w-full max-w-md">

              <input
                type="text"
                placeholder="Enter room ID"
                value={joinRoomId}
                onChange={(event) =>
                  setJoinRoomId(
                    event.target.value
                  )
                }
                className="min-w-0 flex-1 rounded-l-lg bg-white px-4 py-3 text-black outline-none"
              />

              <button
                onClick={joinRoom}
                disabled={!connected}
                className="rounded-r-lg bg-green-600 px-5 py-3 font-medium transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Join
              </button>

            </div>

          </div>

          {roomId && (
            <div className="mt-6 text-center">

              <p className="text-sm text-slate-400">
                Current Room
              </p>

              <p className="mt-1 text-2xl font-bold tracking-wider text-yellow-400">
                {roomId}
              </p>

            </div>
          )}

        </div>

        <div className="mt-8">

          <YouTubePlayer
            ref={playerRef}
            videoId="dQw4w9WgXcQ"
            onPlay={handleLocalPlay}
            onPause={handleLocalPause}
          />

        </div>

        {roomId && (
          <div className="mt-6 rounded-2xl bg-slate-900 p-6">

            <h2 className="text-xl font-semibold">
              Watch Party
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Use the YouTube player controls.
              Play and pause actions are
              synchronized with the room.
            </p>

          </div>
        )}

      </div>
    </main>
  );
}

export default App;