const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on('connection', (socket) => {
  const { roomId, username, isAdmin } = socket.handshake.query;
  console.log('\n=== Новое подключение ===');
  console.log('Socket ID:', socket.id);
  console.log('Room ID:', roomId);
  console.log('Username:', username);
  console.log('Is Admin:', isAdmin);

  if (!roomId || !username) {
    console.log('❌ Отключение: отсутствуют roomId или username');
    socket.disconnect();
    return;
  }

  // Подключение к комнате
  socket.join(roomId);
  console.log(`✅ Пользователь ${username} присоединился к комнате ${roomId}`);
  
  // Инициализация комнаты, если она не существует
  if (!rooms[roomId]) {
    console.log(`📝 Создание новой комнаты: ${roomId}`);
    rooms[roomId] = {
      users: [],
      messages: []
    };
  }

  // Создаем объект пользователя
  const user = {
    id: socket.id,
    username: username,
    isAdmin: isAdmin === 'true',
    isHost: rooms[roomId].host === username,
    isModerator: false
  };

  // Добавление пользователя в комнату
  rooms[roomId].users.push(user);
  console.log(`👥 Пользователи в комнате ${roomId}:`, rooms[roomId].users.map(u => u.username));

  // Если это хост, сохраняем его
  if (user.isHost) {
    rooms[roomId].host = username;
    console.log(`👑 Установлен хост комнаты: ${username}`);
  }

  // Отправка информации о подключении
  io.to(roomId).emit('userJoined', {
    username: user.username,
    isAdmin: user.isAdmin,
    isHost: user.isHost,
    isModerator: user.isModerator
  });
  console.log('📢 Отправлено уведомление о подключении пользователя');

  // Отправка истории сообщений новому пользователю
  socket.emit('messageHistory', rooms[roomId].messages);
  console.log(`📜 Отправлена история сообщений (${rooms[roomId].messages.length} сообщений)`);

  // Обработка новых сообщений
  socket.on('chat message', (message) => {
    console.log('\n=== Новое сообщение ===');
    console.log('От:', message.sender);
    console.log('Текст:', message.text);
    console.log('Токены:', message.tokens);

    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
      isHost: user.isHost || false,
      isModerator: user.isModerator || false
    };

    rooms[roomId].messages.push(newMessage);
    console.log(`💬 Сообщение добавлено в историю комнаты ${roomId}`);
    
    io.to(roomId).emit('chat message', newMessage);
    console.log('📢 Сообщение отправлено всем пользователям в комнате');
  });

  // Обработка WebRTC сигналов
  socket.on('offer', (offer) => {
    console.log('📡 Получен WebRTC offer');
    socket.to(roomId).emit('offer', offer);
    console.log('📡 WebRTC offer переслан');
  });

  socket.on('answer', (answer) => {
    console.log('📡 Получен WebRTC answer');
    socket.to(roomId).emit('answer', answer);
    console.log('📡 WebRTC answer переслан');
  });

  socket.on('ice-candidate', (candidate) => {
    console.log('📡 Получен ICE candidate');
    socket.to(roomId).emit('ice-candidate', candidate);
    console.log('📡 ICE candidate переслан');
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log('\n=== Отключение пользователя ===');
    console.log('Socket ID:', socket.id);
    console.log('Username:', username);
    
    if (rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(
        user => user.id !== socket.id
      );
      console.log(`👥 Пользователь удален из комнаты ${roomId}`);

      // Если отключился хост, очищаем его
      if (rooms[roomId].host === username) {
        rooms[roomId].host = undefined;
        console.log('👑 Хост комнаты удален');
      }

      // Отправляем информацию об отключении
      io.to(roomId).emit('userLeft', {
        username: username,
        isAdmin: isAdmin === 'true',
        isHost: user.isHost
      });
      console.log('📢 Отправлено уведомление об отключении пользователя');
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  console.log('📡 WebSocket сервер готов к подключениям');
}); 