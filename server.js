const express = require("express");
const { createServer } = require("http");
const ws = require("socket.io");
const { users } = require("./users");
const cors = require("cors");

const app = express();
app.use(cors());

const server = createServer(app);
const io = ws(server, {
  cors: {
    origin: [
      "https://socked-front.vercel.app",
      "https://socked-admin.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST"],
  },
});

const rooms = {};

io.on("connection", (socket) => {
  const { roomId, username, role } = socket.handshake.query;

  if (!roomId || !username) {
    socket.disconnect();
    return;
  }

  socket.join(roomId);

  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: [],
      messages: [],
      isLive: false,
      privateMessages: {},
      offerScreenData: null,
      offerVideoData: null,
    };
  }

  const user = {
    id: socket.id,
    username: username,
  };

  rooms[roomId].users.push(user);

  // Запрос офера при подключении
  socket.on("joined", ({ roomId }) => {
    io.to(roomId).emit("request-offer", { viewerSocketId: socket.id });
  });

  io.to(roomId).emit("usersData", users);

  // Отправка истории сообщений новому пользователю
  socket.emit("messageHistory", rooms[roomId].messages);

  socket.on("get-private-messages-history", ({ username }) => {
    if (rooms[roomId].privateMessages[username]) {
      socket.emit(
        "send-private-message-history",
        rooms[roomId].privateMessages?.[username] || []
      );
    }
  });

  socket.on("private-message", ({ username, message }) => {
    const newMessage = {
      ...message,
      toUser: username,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    if (!rooms[roomId].privateMessages[username]) {
      rooms[roomId].privateMessages[username] = [];
    }
    rooms[roomId].privateMessages[username].push(newMessage);
    io.to(roomId).emit("private-message", newMessage);
  });

  // --- Camera-share signaling ---
  socket.on("offer", (data) => {
    rooms[roomId].offerVideoData = data.offer;
    const targetSocketId = data.to;
    if (targetSocketId) {
      io.to(targetSocketId).emit("offer", data);
    } else {
      socket.to(roomId).emit("offer", data); // fallback (на всякий случай)
    }
  });

  socket.on("answer", (data) => {
    rooms[roomId].isLive = true;
    socket.to(roomId).emit("answer", data);
  });

  socket.on("broadcast-ended", (data) => {
    io.to(roomId).emit("broadcast-ended", data);
    rooms[roomId].isLive = false
    rooms[roomId].offerVideoData = null;
  });

  // --- Screen-share signaling ---

socket.on("screen-offer", (data) => {
  const targetSocketId = data.to;
  if (targetSocketId) {
    io.to(targetSocketId).emit("screen-offer", data);
  } else {
    socket.to(roomId).emit("screen-offer", data);
  }
});

  socket.on("screen-answer", (data) => {
    rooms[roomId].isLive = true
    socket.to(roomId).emit("screen-answer", data);
  });

  socket.on("screen-ended", (data) => {
    rooms[roomId].isLive = false
    socket.to(roomId).emit("screen-ended", data);
    rooms[roomId].offerScreenData = null;
  });

  // Обработка отключения
  socket.on("disconnect", () => {
    if (rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (user) => user.id !== socket.id
      );

      if (role === "broadcaster") {
      rooms[roomId].isLive = false;
      io.to(roomId).emit("broadcast-ended", { roomId });
    }

      // Отправляем информацию об отключении
      io.to(roomId).emit("userLeft", {
        username: username,
      });
    }
  });

  // Остальные обработчики событий...
  socket.on("ask-private", ({ roomId, username }) => {
    if (!rooms[roomId].privateMessages[username]) {
      rooms[roomId].privateMessages[username] = [];
    }
    io.to(roomId).emit("private-request", { username });
  });

  socket.on("user-accept-private", ({ roomId }) => {
    io.to(roomId).emit("start-private");
  });

  socket?.on("private-finished", ({ roomId }) => {
    io.to(roomId).emit("private-finished");
  });

  socket.on("delete-all-messages", ({ roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].messages = [];
      io.to(roomId).emit("messages-deleted");
    }
  });

  socket.on("chat message", (message) => {
    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    rooms[roomId].messages.push(newMessage);

    io.to(roomId).emit("chat message", newMessage);
  });

    socket.on("check-status", ({ roomId }) => {
    io.to(roomId).emit("check-status", { isLive: rooms[roomId].isLive });
  });

});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  console.log("📡 WebSocket сервер готов к подключениям");
});
