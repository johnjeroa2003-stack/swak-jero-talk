const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("public/uploads"));

// 🔥 MongoDB
mongoose.connect(process.env.MONGO_URI);

// 📸 Upload setup
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// 👤 USER MODEL
const User = mongoose.model("User", {
  email: String,
  password: String,
  name: String,
  photo: String,
});

// 💬 MESSAGE MODEL
const Message = mongoose.model("Message", {
  user: String,
  photo: String,
  room: String,
  message: String,
  time: { type: Date, default: Date.now },
});

// LOGIN PAGE
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 🔐 REGISTER WITH PHOTO
app.post("/register", upload.single("photo"), async (req, res) => {
  const { email, password, name } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  await new User({
    email,
    password: hashed,
    name,
    photo: req.file.filename,
  }).save();

  res.json({ message: "Registered" });
});

// 🔐 LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "No user" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.json({ message: "Wrong password" });

  const token = jwt.sign({ id: user._id }, "secretkey");

  res.json({
    token,
    name: user.name,
    photo: user.photo,
  });
});

// ---------------- CHAT ----------------
let users = {};

io.on("connection", (socket) => {
  socket.on("join-room", async ({ username, room, photo }) => {
    socket.join(room);
    users[socket.id] = { username, room, photo };

    const oldMessages = await Message.find({ room })
      .sort({ time: 1 })
      .limit(50);
    socket.emit("load-messages", oldMessages);

    const roomUsers = Object.entries(users)
      .filter(([id, u]) => u.room === room)
      .map(([id, u]) => ({ id, username: u.username, photo: u.photo }));

    socket.emit("joined-success", { room });

    io.to(room).emit("update-users", roomUsers);
  });

  socket.on("send-message", async (msg) => {
    const user = users[socket.id];
    if (!user) return;

    await new Message({
      user: user.username,
      photo: user.photo,
      room: user.room,
      message: msg,
    }).save();

    io.to(user.room).emit("receive-message", {
      user: user.username,
      photo: user.photo,
      message: msg,
    });
  });
});

// PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🔥 Server running on port " + PORT);
});
