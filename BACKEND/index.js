import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();
const server = http.createServer(app);

const url = "https://real-time-code-editor-final-updated.onrender.com";
const interval = 30000;

// keep render alive
function reloadWebsite() {
  axios.get(url)
    .then(() => console.log("Website reloaded"))
    .catch((err) => console.log(err.message));
}

setInterval(reloadWebsite, interval);

const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = new Map();

const languageMap = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54
};

io.on("connection", (socket) => {

  console.log("user connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // JOIN ROOM
  socket.on("join", ({ roomId, username }) => {

    currentRoom = roomId;
    currentUser = username;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        code: "// Start coding...",
        language: "javascript"
      });
    }

    rooms.get(roomId).users.add(username);

    socket.emit("codeUpdate", rooms.get(roomId).code);
    socket.emit("languageUpdated", rooms.get(roomId).language);

    io.to(roomId).emit(
      "userJoined",
      Array.from(rooms.get(roomId).users)
    );
  });

  // CODE CHANGE
  socket.on("codeChange", ({ roomId, code }) => {

    if (rooms.has(roomId)) {
      rooms.get(roomId).code = code;
    }

    io.to(roomId).emit("codeUpdate", code);

  });

  // TYPING
  socket.on("typing", ({ roomId, username }) => {
    socket.to(roomId).emit("usertyping", username);
  });

  // LANGUAGE CHANGE
  socket.on("languageChange", ({ roomId, language }) => {

    if (rooms.has(roomId)) {
      rooms.get(roomId).language = language;
    }

    io.to(roomId).emit("languageUpdated", language);

  });

  // RUN CODE
  socket.on("compileCode", async ({ code, roomId, language, input }) => {

    try {

      if (!rooms.has(roomId)) return;

      const languageId = languageMap[language];

      const response = await axios.post(
        "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
        {
          source_code: code,
          language_id: languageId,
          stdin: input
        }
      );

      const output =
        response.data.stdout ||
        response.data.stderr ||
        response.data.compile_output ||
        "No output";

      io.to(roomId).emit("codeResponse", {
        run: { output }
      });

    } catch {

      io.to(roomId).emit("codeResponse", {
        run: { output: "Execution error" }
      });

    }

  });

  // LEAVE ROOM
  socket.on("leaveRoom", () => {

    if (currentRoom && rooms.has(currentRoom)) {

      rooms.get(currentRoom).users.delete(currentUser);

      io.to(currentRoom).emit(
        "userJoined",
        Array.from(rooms.get(currentRoom).users)
      );

      socket.leave(currentRoom);

      currentRoom = null;
      currentUser = null;

    }

  });

  // DISCONNECT
  socket.on("disconnect", () => {

    if (currentRoom && rooms.has(currentRoom)) {

      rooms.get(currentRoom).users.delete(currentUser);

      io.to(currentRoom).emit(
        "userJoined",
        Array.from(rooms.get(currentRoom).users)
      );

    }

    console.log("user disconnected");

  });

});

const port = process.env.PORT || 5000;

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/FRONTEND/dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "FRONTEND", "dist", "index.html"));
});

server.listen(port, () => {
  console.log(`Server running on ${port}`);
});
