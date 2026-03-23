const socket = io();

let localStream;
let analyser, dataArray;
let isMuted = false;

// 🚀 JOIN ROOM (WITH PROFILE)
async function join() {
  const username = localStorage.getItem("name");
  const photo = localStorage.getItem("photo");
  const room = document.getElementById("room").value;

  if (!username || !room) {
    alert("Login and enter room name!");
    return;
  }

  // 🎤 Get mic
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  setupAudioAnalysis();

  socket.emit("join-room", { username, room, photo });
}

// 🎤 AUDIO DETECTION
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

// 🎤 MUTE / UNMUTE
function toggleMute() {
  if (!localStream) return alert("Join first!");

  isMuted = !isMuted;
  localStream.getAudioTracks()[0].enabled = !isMuted;

  const btn = document.getElementById("micBtn");
  btn.innerText = isMuted ? "🔇 OFF" : "🎤 ON";
}

// 👥 UPDATE USERS WITH PROFILE
socket.on("update-users", (users) => {
  const userDiv = document.getElementById("users");
  userDiv.innerHTML = "";

  users.forEach((u) => {
    const div = document.createElement("div");
    div.className = "user";

    div.innerHTML = `
      <img src="/uploads/${u.photo}" width="30" style="border-radius:50%">
      <span>${u.username}</span>
    `;

    userDiv.appendChild(div);
  });
});

// 📜 LOAD OLD MESSAGES
socket.on("load-messages", (messages) => {
  const box = document.getElementById("messages");
  box.innerHTML = "";

  messages.forEach((msg) => {
    const div = document.createElement("div");

    div.innerHTML = `
      <img src="/uploads/${msg.photo}" width="30" style="border-radius:50%">
      <b>${msg.user}:</b> ${msg.message}
    `;

    box.appendChild(div);
  });
});

// 💬 SEND MESSAGE
function sendMsg() {
  const msgInput = document.getElementById("msg");
  const msg = msgInput.value;

  if (!msg) return;

  const username = localStorage.getItem("name");
  const photo = localStorage.getItem("photo");

  const div = document.createElement("div");
  div.innerHTML = `
    <img src="/uploads/${photo}" width="30" style="border-radius:50%">
    <b>You:</b> ${msg}
  `;

  document.getElementById("messages").appendChild(div);

  socket.emit("send-message", msg);

  msgInput.value = "";
}

// 📩 RECEIVE MESSAGE
socket.on("receive-message", (data) => {
  const div = document.createElement("div");

  div.innerHTML = `
    <img src="/uploads/${data.photo}" width="30" style="border-radius:50%">
    <b>${data.user}:</b> ${data.message}
  `;

  document.getElementById("messages").appendChild(div);
});

// ⌨️ ENTER KEY SEND
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("msg").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMsg();
  });
});
