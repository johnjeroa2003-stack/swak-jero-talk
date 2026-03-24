const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

let users = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ username, room }) => {
    socket.join(room);
    users[socket.id] = { username, room };

    socket.to(room).emit("user-joined", socket.id);
  });

  // WebRTC signaling
  socket.on("offer", ({ target, sdp }) => {
    io.to(target).emit("offer", {
      sender: socket.id,
      sdp,
    });
  });

  socket.on("answer", ({ target, sdp }) => {
    io.to(target).emit("answer", {
      sender: socket.id,
      sdp,
    });
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    io.to(target).emit("ice-candidate", {
      sender: socket.id,
      candidate,
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on " + PORT));
