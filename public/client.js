const socket = io();

let localStream;
let peers = {};
let isMuted = false;
let analyser, dataArray;

// JOIN
async function join() {
  const username = document.getElementById("username").value;
  const room = document.getElementById("room").value;

  if (!username || !room) return alert("Enter details");

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  setupAudioAnalysis();

  socket.emit("join-room", { username, room });
}

// AUDIO DETECTION (speaking)
function setupAudioAnalysis() {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(localStream);

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  detectSpeaking();
}

function detectSpeaking() {
  analyser.getByteFrequencyData(dataArray);

  let volume = dataArray.reduce((a, b) => a + b) / dataArray.length;

  if (volume > 20) {
    document.getElementById("micBtn").style.background = "green";
  } else {
    document.getElementById("micBtn").style.background = "#00c6ff";
  }

  requestAnimationFrame(detectSpeaking);
}

// JOIN SUCCESS
socket.on("joined-success", ({ room }) => {
  document.querySelector(".topbar").style.display = "none";
  document.getElementById("roomName").innerText = "Room: " + room;
});

// MUTE
function toggleMute() {
  if (!localStream) return alert("Join first!");

  isMuted = !isMuted;
  localStream.getAudioTracks()[0].enabled = !isMuted;

  const btn = document.getElementById("micBtn");
  btn.innerText = isMuted ? "🔇 OFF" : "🎤 ON";
}

// USERS UI
socket.on("update-users", (users) => {
  const userDiv = document.getElementById("users");
  userDiv.innerHTML = "";

  users.forEach((u) => {
    const div = document.createElement("div");
    div.className = "user";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerText = u.username[0];

    const name = document.createElement("span");
    name.innerText = u.username;

    div.appendChild(avatar);
    div.appendChild(name);

    userDiv.appendChild(div);
  });
});

// CHAT
function sendMsg() {
  const msg = document.getElementById("msg").value;
  if (!msg) return;

  const div = document.createElement("div");
  div.innerText = "You: " + msg;
  document.getElementById("messages").appendChild(div);

  socket.emit("send-message", msg);
  document.getElementById("msg").value = "";
}

// ENTER KEY
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("msg").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMsg();
  });
});

// RECEIVE MSG
socket.on("receive-message", (data) => {
  const div = document.createElement("div");
  div.innerText = data.user + ": " + data.message;
  document.getElementById("messages").appendChild(div);
});
