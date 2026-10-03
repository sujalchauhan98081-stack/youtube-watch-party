import { useCallback, useEffect, useRef, useState } from "react";

import YouTubePlayer from "./components/YouTubePlayer";

import type { YouTubePlayerHandle } from "./components/YouTubePlayer";

import { socket } from "./lib/socket";

function App() {
  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  const [connected, setConnected] = useState(false);

  const [serverMessage, setServerMessage] = useState("");

  const [roomId, setRoomId] = useState("");

  const [joinRoomId, setJoinRoomId] = useState("");
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ");

  const [videoInput, setVideoInput] = useState("");

  // Stores the playback state received from the server.
  // YouTubePlayer applies it when the player is ready.
  const [syncState, setSyncState] = useState<{
    currentTime: number;
    isPlaying: boolean;
  } | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      console.log("SOCKET CONNECTED:", socket.id);

      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log("SOCKET DISCONNECTED");

      setConnected(false);
    };

    const handleServerReady = (data: { message: string }) => {
      console.log("SERVER READY:", data.message);

      setServerMessage(data.message);
    };

    const handleRoomCreated = (data: {
      roomId: string;
      role: string;
    }) => {
      console.log("ROOM CREATED:", data);

      setRoomId(data.roomId);

      setServerMessage(
        `Room created successfully as ${data.role}`
      );
    };

    const handleRoomJoined = (data: {
      roomId: string;
      role: string;
    }) => {
      console.log("ROOM JOINED:", data);

      setRoomId(data.roomId);

      setServerMessage(`Joined room as ${data.role}`);
    };

    const handleVideoChanged = (data: {
      videoId: string;
    }) => {
      console.log("========== VIDEO CHANGED ==========");

      console.log("New video:", data.videoId);

      // Clear previous sync state because this is a new video.
      setSyncState(null);

      setVideoId(data.videoId);

      setServerMessage(
        `Video changed to ${data.videoId}`
      );
    };

    const handleSyncState = (data: {
      videoId: string | null;
      currentTime: number;
      isPlaying: boolean;
    }) => {
      console.log("========== SYNC STATE ==========");

      console.log("Sync state received:", data);

      if (!data.videoId) {
        console.log(
          "SYNC: room does not have a video yet"
        );

        return;
      }

      console.log(
        `SYNC: video=${data.videoId}, time=${data.currentTime}, playing=${data.isPlaying}`
      );

      setVideoId(data.videoId);

      /*
       * Store the state instead of trying to control
       * the player after an arbitrary 100ms timeout.
       *
       * YouTubePlayer will apply this state when
       * the YouTube iframe is actually ready.
       */
      setSyncState({
        currentTime: data.currentTime,
        isPlaying: data.isPlaying,
      });
    };

    const handleRoomError = (data: {
      message: string;
    }) => {
      console.log("ROOM ERROR:", data.message);

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

      playerRef.current.seek(data.currentTime);

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

      playerRef.current.seek(data.currentTime);

      playerRef.current.pauseFromRemote();
    };

    const handleRemoteSeek = (data: {
      currentTime: number;
    }) => {
      console.log(
        "========== REMOTE SEEK =========="
      );

      console.log(
        "Remote time:",
        data.currentTime
      );

      if (!playerRef.current) {
        console.log(
          "Remote SEEK failed: player not ready"
        );

        return;
      }

      playerRef.current.seekFromRemote(
        data.currentTime
      );
    };

    socket.on("connect", handleConnect);

    socket.on("disconnect", handleDisconnect);

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

    socket.on("play", handleRemotePlay);

    socket.on(
      "pause",
      handleRemotePause
    );

    socket.on(
      "seek",
      handleRemoteSeek
    );

    socket.on(
      "video_changed",
      handleVideoChanged
    );

    socket.on(
      "sync_state",
      handleSyncState
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

      socket.off(
        "seek",
        handleRemoteSeek
      );

      socket.off(
        "video_changed",
        handleVideoChanged
      );

      socket.off(
        "sync_state",
        handleSyncState
      );

      socket.disconnect();
    };
  }, []);

  /*
   * LOCAL YOUTUBE PLAY
   */
  const handleLocalPlay = useCallback(() => {
    if (!roomId) {
      console.log("PLAY ignored: no room");

      return;
    }

    const currentTime =
      playerRef.current?.getCurrentTime() ?? 0;

    console.log(
      "========== LOCAL PLAY =========="
    );

    console.log("Room:", roomId);

    console.log("Time:", currentTime);

    console.log("Socket:", socket.id);

    socket.emit("play", {
      roomId,
      currentTime,
    });
  }, [roomId]);

  /*
   * LOCAL YOUTUBE PAUSE
   */
  const handleLocalPause = useCallback(() => {
    if (!roomId) {
      console.log("PAUSE ignored: no room");

      return;
    }

    const currentTime =
      playerRef.current?.getCurrentTime() ?? 0;

    console.log(
      "========== LOCAL PAUSE =========="
    );

    console.log("Room:", roomId);

    console.log("Time:", currentTime);

    console.log("Socket:", socket.id);

    socket.emit("pause", {
      roomId,
      currentTime,
    });
  }, [roomId]);

  /*
   * LOCAL YOUTUBE SEEK
   */
  const handleLocalSeek = useCallback(
    (currentTime: number) => {
      if (!roomId) {
        console.log("SEEK ignored: no room");

        return;
      }

      console.log(
        "========== LOCAL SEEK =========="
      );

      console.log("Room:", roomId);

      console.log("Time:", currentTime);

      console.log("Socket:", socket.id);

      socket.emit("seek", {
        roomId,
        currentTime,
      });
    },
    [roomId]
  );

  /*
   * CHANGE VIDEO
   */
  const handleChangeVideo = () => {
    if (!roomId) {
      setServerMessage(
        "Join a room before changing the video"
      );

      return;
    }

    const newVideoId = videoInput.trim();

    if (!newVideoId) {
      setServerMessage(
        "Please enter a YouTube video ID"
      );

      return;
    }

    console.log(
      "========== CHANGE VIDEO =========="
    );

    console.log("Room:", roomId);

    console.log("Video:", newVideoId);

    socket.emit("change_video", {
      roomId,
      videoId: newVideoId,
    });

    setVideoInput("");
  };

  /*
   * CREATE ROOM
   */
  const createRoom = () => {
    console.log("CREATE ROOM REQUEST");

    socket.emit("create_room", {
      username: "Sujal",
    });
  };

  /*
   * JOIN ROOM
   */
  const joinRoom = () => {
    if (!joinRoomId.trim()) {
      setServerMessage(
        "Please enter a room ID"
      );

      return;
    }

    const room =
      joinRoomId.trim().toUpperCase();

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
            videoId={videoId}
            onPlay={handleLocalPlay}
            onPause={handleLocalPause}
            onSeek={handleLocalSeek}
            syncState={syncState}
          />
        </div>

        {roomId && (
          <div className="mt-6 rounded-2xl bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">
              Watch Party
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Play, pause, seek, or change the
              video using the watch party controls.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Enter YouTube video ID"
                value={videoInput}
                onChange={(event) =>
                  setVideoInput(
                    event.target.value
                  )
                }
                className="min-w-0 flex-1 rounded-lg bg-white px-4 py-3 text-black outline-none"
              />

              <button
                onClick={handleChangeVideo}
                disabled={!connected}
                className="rounded-lg bg-purple-600 px-5 py-3 font-medium transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Change Video
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Current video ID: {videoId}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;