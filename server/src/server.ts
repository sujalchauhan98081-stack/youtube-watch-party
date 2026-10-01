import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();  // creates our http application

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {  // creates our Socket.io server
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Watch Party server is running",
  });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit("server:ready", {
    message: "Socket connection established",
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});