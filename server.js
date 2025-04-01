const express = require("express");
const { createServer } = require("http");
const ws = require("socket.io");
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

  // Если это хост, сохраняем его
  if (user.isHost) {
    rooms[roomId].host = username;
  }

  // Отправка информации о подключении
  io.to(roomId).emit("userJoined", {
    username: user.username,
  });

  // Отправка истории сообщений новому пользователю
  socket.emit("messageHistory", rooms[roomId].messages);


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
    console.log("📡 Получен offer от Broadcaster");
    socket.to(roomId).emit("offer", { offer, username });
  });

  socket.on("answer", ({ answer, roomId, username }) => {
    console.log("📡 Получен answer от Viewer");
    socket.to(roomId).emit("answer", { answer, username });
  });

  socket.on("ice-candidate", ({ candidate, roomId, username }) => {
    console.log("📡 Получен ICE-кандидат");
    socket.to(roomId).emit("ice-candidate", { candidate, username });
  });

  socket.on("broadcast-ended", ({ roomId, username }) => {
    console.log(`❌ Стрим завершён пользователем: ${username}`);
    socket.broadcast.emit("broadcast-ended", { roomId, username });
  });

  socket.on("delete-all-messages", ({ roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].messages = []; // Очищаем массив сообщений
      io.to(roomId).emit("messages-deleted"); // Уведомляем всех в комнате
      console.log(`🗑️ Все сообщения удалены в комнате: ${roomId}`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  console.log("📡 WebSocket сервер готов к подключениям");
});
