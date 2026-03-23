const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Store users
let users = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ username, room }) => {
    const maxUsers = 4; // 👥 room limit

    const currentUsers = Object.values(users).filter((u) => u.room === room);

    // ❌ Room full
    if (currentUsers.length >= maxUsers) {
      socket.emit("room-full");
      return;
    }

    socket.join(room);

    users[socket.id] = { username, room };

    const roomUsers = Object.entries(users)
      .filter(([id, u]) => u.room === room)
      .map(([id, u]) => ({ id, username: u.username }));

    // ✅ Success join
    socket.emit("joined-success", { room });

    socket.emit(
      "all-users",
      roomUsers.filter((u) => u.id !== socket.id),
    );

    socket.to(room).emit("user-joined", {
      id: socket.id,
      username,
    });

    io.to(room).emit("update-users", roomUsers);
  });

  // 💬 Chat
  socket.on("send-message", (msg) => {
    const user = users[socket.id];
    if (!user) return;

    io.to(user.room).emit("receive-message", {
      user: user.username,
      message: msg,
    });
  });

  // 🎤 WebRTC signaling
  socket.on("offer", ({ target, sdp }) => {
    io.to(target).emit("offer", { sender: socket.id, sdp });
  });

  socket.on("answer", ({ target, sdp }) => {
    io.to(target).emit("answer", { sender: socket.id, sdp });
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    io.to(target).emit("ice-candidate", { sender: socket.id, candidate });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (!user) return;

    socket.to(user.room).emit("user-left", socket.id);

    delete users[socket.id];

    const roomUsers = Object.entries(users)
      .filter(([id, u]) => u.room === user.room)
      .map(([id, u]) => ({ id, username: u.username }));

    io.to(user.room).emit("update-users", roomUsers);
  });
});

// 🚀 IMPORTANT (for Render / deployment)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🔥 Server running on port " + PORT);
});
