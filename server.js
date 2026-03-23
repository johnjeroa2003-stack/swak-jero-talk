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

// 🔥 CONNECT MONGODB (WORKS ONLINE)
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ DB Error:", err));

// ---------------- MODELS ----------------
const User = mongoose.model("User", {
  email: String,
  password: String,
});

const Message = mongoose.model("Message", {
  user: String,
  room: String,
  message: String,
  time: { type: Date, default: Date.now },
});

// ---------------- ROUTES ----------------

// Login page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Register
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);
    await new User({ email, password: hashed }).save();
    res.json({ message: "Registered" });
  } catch {
    res.status(500).json({ message: "Error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "No user" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.json({ message: "Wrong password" });

  const token = jwt.sign({ id: user._id }, "secretkey");
  res.json({ token });
});

// ---------------- CHAT ----------------
let users = {};

io.on("connection", (socket) => {
  socket.on("join-room", async ({ username, room }) => {
    socket.join(room);
    users[socket.id] = { username, room };

    // 📜 Load old messages
    const oldMessages = await Message.find({ room })
      .sort({ time: 1 })
      .limit(50);
    socket.emit("load-messages", oldMessages);

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

  socket.on("send-message", async (msg) => {
    const user = users[socket.id];
    if (!user) return;

    // 💾 Save message
    await new Message({
      user: user.username,
      room: user.room,
      message: msg,
    }).save();

    io.to(user.room).emit("receive-message", {
      user: user.username,
      message: msg,
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

// ---------------- PORT ----------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🔥 Server running on port " + PORT);
});
