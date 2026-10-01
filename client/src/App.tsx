import { useEffect, useState } from "react";
import { socket } from "./lib/socket";

function App() {
  const [connected, setConnected] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:ready", handleServerReady);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:ready", handleServerReady);
      socket.disconnect();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">
          YouTube Watch Party
        </h1>

        <p className="mt-3 text-slate-400">
          Real-time watch party application
        </p>

        <div className="mt-8">
          <p>
            Socket status:{" "}
            <span className={connected ? "text-green-400" : "text-red-400"}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </p>

          {serverMessage && (
            <p className="mt-3 text-green-400">
              Server: {serverMessage}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;