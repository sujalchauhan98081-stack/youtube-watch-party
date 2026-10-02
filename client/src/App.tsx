import { useEffect, useRef, useState } from "react";
import { socket } from "./lib/socket";
import YouTubePlayer from "./components/YouTubePlayer";
import type { YouTubePlayerHandle } from "./components/YouTubePlayer";

function App() {
  const [connected, setConnected] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleServerReady = (data: { message: string }) => {
      setServerMessage(data.message);
    };

    const handleRoomCreated = (data: { roomId: string; role: string }) => {
      setRoomId(data.roomId);
      setServerMessage(`Room created successfully as ${data.role}`);
    };

    const handleRoomJoined = (data: { roomId: string; role: string }) => {
      setRoomId(data.roomId);
      setServerMessage(`Joined room as ${data.role}`);
    };
    const handleUserJoined = (data: {
      participant: {
        userId: string;
        username: string;
        role: string;
      };
    }) => {
      setServerMessage(`${data.participant.username} joined the room`);
    };

    const handleRoomError = (data: { message: string }) => {
      setServerMessage(data.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:ready", handleServerReady);
    socket.on("room_created", handleRoomCreated);
    socket.on("room_joined", handleRoomJoined);
    socket.on("user_joined", handleUserJoined);
    socket.on("room_error", handleRoomError);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:ready", handleServerReady);
      socket.off("room_created", handleRoomCreated);
      socket.off("room_joined", handleRoomJoined);
      socket.off("user_joined", handleUserJoined);
      socket.off("room_error", handleRoomError);

      socket.disconnect();
    };
  }, []);

  const createRoom = () => {
    socket.emit("create_room", {
      username: "Sujal",
    });
  };

  const joinRoom = () => {
    if (!joinRoomId.trim()) {
      setServerMessage("Please enter a room ID");
      return;
    }

    socket.emit("join_room", {
      roomId: joinRoomId.trim(),
      username: "Rahul",
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">YouTube Watch Party</h1>

        <p className="mt-3 text-slate-400">Real-time watch party application</p>

        <div className="mt-8">
          {/* Socket connection status */}
          <p>
            Socket status:{" "}
            <span className={connected ? "text-green-400" : "text-red-400"}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </p>

          {/* Server / room message */}
          {serverMessage && (
            <p className="mt-3 text-green-400">{serverMessage}</p>
          )}

          {/* Create room */}
          <button
            onClick={createRoom}
            disabled={!connected}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Room
          </button>

          {/* Join room */}
          <div className="mt-6">
            <input
              type="text"
              placeholder="Enter room ID"
              value={joinRoomId}
              onChange={(event) => setJoinRoomId(event.target.value)}
              className="rounded-lg bg-white px-4 py-3 text-black outline-none"
            />

            <button
              onClick={joinRoom}
              disabled={!connected}
              className="ml-3 rounded-lg bg-green-600 px-5 py-3 font-medium hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join Room
            </button>
          </div>

          {/* Current room */}
          {roomId && (
            <p className="mt-4 text-xl">
              Room ID:{" "}
              <span className="font-bold text-yellow-400">{roomId}</span>
            </p>
          )}
          <YouTubePlayer ref={playerRef} videoId="dQw4w9WgXcQ" />
          <div className="mt-4 flex justify-center gap-3">
  <button
    onClick={() => {
      console.log("Play button clicked");
      console.log("Player ref:", playerRef.current);

      playerRef.current?.play();
    }}
    className="rounded-lg bg-green-600 px-4 py-2 hover:bg-green-500"
  >
    ▶ Play
  </button>

  <button
    onClick={() => {
      console.log("Pause button clicked");
      console.log("Player ref:", playerRef.current);

      playerRef.current?.pause();
    }}
    className="rounded-lg bg-red-600 px-4 py-2 hover:bg-red-500"
  >
    ⏸ Pause
  </button>

  <button
    onClick={() => {
      console.log("Seek button clicked");
      console.log("Player ref:", playerRef.current);

      playerRef.current?.seek(30);
    }}
    className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-500"
  >
    ⏩ Seek 30s
  </button>
</div>

          
        </div>
      </div>
    </main>
  );
}

export default App;
