const express = require("express");
const { createServer } = require("http");
const ws = require("socket.io");
const { users } = require('./users');
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

  // Подключение к комнате
  socket.join(roomId);

  // Инициализация комнаты, если она не существует
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: [],
      messages: [],
      broadcasterOffer: null,
      privateMessages: {}
    };
  }

  // Создаем объект пользователя
  const user = {
    id: socket.id,
    username: username,
  };

  if (role === "viewer" && rooms[roomId].broadcasterOffer) {
    socket.emit("offer", { offer: rooms[roomId].broadcasterOffer });
  }

  // Добавление пользователя в комнату
  rooms[roomId].users.push(user);


  // Отправка информации о подключении
  io.to(roomId).emit("userJoined", {
    username: user.username,
  });

  io.to(roomId).emit('usersData', users);

  // Отправка истории сообщений новому пользователю
  socket.emit("messageHistory", rooms[roomId].messages);

  socket.on("get-private-messages-history", ({ username }) => {
    if(rooms[roomId].privateMessages[username]) {
      socket.emit('send-private-message-history', rooms[roomId].privateMessages?.[username] || [])
    }
  })

  socket.on("private-message", ({ username, message }) => {
    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    if (!rooms[roomId].privateMessages[username]) {
      rooms[roomId].privateMessages[username] = [];
    }
    rooms[roomId].privateMessages[username].push(newMessage);
    io.to(roomId).emit("private-message", newMessage);
  });


  socket.on("disconnect", () => {


    socket.broadcast.emit('callEnded')

    if (rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (user) => user.id !== socket.id
      );

      // Если отключился хост, очищаем его
      if (rooms[roomId].host === username) {
        rooms[roomId].host = undefined;
      }

      // Отправляем информацию об отключении
      io.to(roomId).emit("userLeft", {
        username: username,
      });
    }
  });

  // Обработка новых сообщений
  socket.on("chat message", (message) => {

    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    rooms[roomId].messages.push(newMessage);

    io.to(roomId).emit("chat message", newMessage);
  });

  socket.on("offer", ({ offer, roomId, username }) => {
    socket.to(roomId).emit("offer", { offer, username });
    rooms[roomId].broadcasterOffer = offer;
  });

  socket.on('join-room', () => {
    if (rooms[roomId] && rooms[roomId].broadcasterOffer) {
      socket.emit("offer", { offer: rooms[roomId].broadcasterOffer });
    }
  })

  socket.on("answer", ({ answer, roomId, username }) => {
    console.log("📡 Получен answer от Viewer");
    socket.to(roomId).emit("answer", { answer, username });
  });

  socket.on("ice-candidate", ({ candidate, roomId, username }) => {
    socket.to(roomId).emit("ice-candidate", { candidate, username });
  });

  socket.on("broadcast-ended", ({ roomId, username }) => {
    socket.broadcast.emit("broadcast-ended", { roomId, username });
  });

  socket.on("ask-private", ({roomId , username}) => {
    if (!rooms[roomId].privateMessages[username]) {
      rooms[roomId].privateMessages[username] = [];
    }
    io.to(roomId).emit("private-request", { username })
  });

  socket.on("user-accept-private", ({ roomId }) => {
    io.to(roomId).emit("start-private");
  })

  socket?.on("private-finished", ({ roomId }) => {
    io.to(roomId).emit("private-finished");
  });

  socket.on("delete-all-messages", ({ roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].messages = []; // Очищаем массив сообщений
      io.to(roomId).emit("messages-deleted"); // Уведомляем всех в комнате
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  console.log("📡 WebSocket сервер готов к подключениям");
});
