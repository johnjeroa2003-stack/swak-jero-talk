const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 🔥 CONNECT DATABASE (MongoDB)
mongoose.connect("mongodb://127.0.0.1:27017/swakjero", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// USER MODEL
const User = mongoose.model("User", {
  email: String,
  password: String,
});

// 🔐 REGISTER
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = new User({ email, password: hashed });
  await user.save();

  res.json({ message: "User registered" });
});

// 🔐 LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign({ id: user._id }, "secretkey");

  res.json({ token });
});

// ---------------- CHAT ----------------
let users = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ username, room }) => {
    socket.join(room);
    users[socket.id] = { username, room };

    const roomUsers = Object.entries(users)
      .filter(([id, u]) => u.room === room)
      .map(([id, u]) => ({ id, username: u.username }));

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

  socket.on("send-message", (msg) => {
    const user = users[socket.id];
    if (!user) return;

    io.to(user.room).emit("receive-message", {
      user: user.username,
      message: msg,
    });
  });
});

// 🚀 PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🔥 Server running on port " + PORT);
});
