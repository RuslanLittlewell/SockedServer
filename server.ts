import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"]
  }
});

interface Room {
  users: User[];
  messages: Message[];
  host?: string;
}

interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
  isHost?: boolean;
  isModerator?: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
  isHost: boolean;
  isModerator: boolean;
  tokens: number;
}

const rooms: { [key: string]: Room } = {};

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
  socket.join(roomId as string);
  console.log(`✅ Пользователь ${username} присоединился к комнате ${roomId}`);
  
  // Инициализация комнаты, если она не существует
  if (!rooms[roomId as string]) {
    console.log(`📝 Создание новой комнаты: ${roomId}`);
    rooms[roomId as string] = {
      users: [],
      messages: []
    };
  }

  // Создаем объект пользователя
  const user: User = {
    id: socket.id,
    username: username as string,
    isAdmin: isAdmin === 'true',
    isHost: rooms[roomId as string].host === username,
    isModerator: false
  };

  // Добавление пользователя в комнату
  rooms[roomId as string].users.push(user);
  console.log(`👥 Пользователи в комнате ${roomId}:`, rooms[roomId as string].users.map(u => u.username));

  // Если это хост, сохраняем его
  if (user.isHost) {
    rooms[roomId as string].host = username as string;
    console.log(`👑 Установлен хост комнаты: ${username}`);
  }

  // Отправка информации о подключении
  io.to(roomId as string).emit('userJoined', {
    username: user.username,
    isAdmin: user.isAdmin,
    isHost: user.isHost,
    isModerator: user.isModerator
  });
  console.log('📢 Отправлено уведомление о подключении пользователя');

  // Отправка истории сообщений новому пользователю
  socket.emit('messageHistory', rooms[roomId as string].messages);
  console.log(`📜 Отправлена история сообщений (${rooms[roomId as string].messages.length} сообщений)`);

  // Обработка новых сообщений
  socket.on('chat message', (message: Omit<Message, 'id' | 'timestamp' | 'isHost' | 'isModerator'>) => {
    console.log('\n=== Новое сообщение ===');
    console.log('От:', message.sender);
    console.log('Текст:', message.text);
    console.log('Токены:', message.tokens);

    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
      isHost: user.isHost || false,
      isModerator: user.isModerator || false
    };

    rooms[roomId as string].messages.push(newMessage);
    console.log(`💬 Сообщение добавлено в историю комнаты ${roomId}`);
    
    io.to(roomId as string).emit('chat message', newMessage);
    console.log('📢 Сообщение отправлено всем пользователям в комнате');
  });

  // Обработка WebRTC сигналов
  socket.on('offer', (offer) => {
    console.log('📡 Получен WebRTC offer');
    socket.to(roomId as string).emit('offer', offer);
    console.log('📡 WebRTC offer переслан');
  });

  socket.on('answer', (answer) => {
    console.log('📡 Получен WebRTC answer');
    socket.to(roomId as string).emit('answer', answer);
    console.log('📡 WebRTC answer переслан');
  });

  socket.on('ice-candidate', (candidate) => {
    console.log('📡 Получен ICE candidate');
    socket.to(roomId as string).emit('ice-candidate', candidate);
    console.log('📡 ICE candidate переслан');
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log('\n=== Отключение пользователя ===');
    console.log('Socket ID:', socket.id);
    console.log('Username:', username);
    
    if (rooms[roomId as string]) {
      rooms[roomId as string].users = rooms[roomId as string].users.filter(
        user => user.id !== socket.id
      );
      console.log(`👥 Пользователь удален из комнаты ${roomId}`);

      // Если отключился хост, очищаем его
      if (rooms[roomId as string].host === username) {
        rooms[roomId as string].host = undefined;
        console.log('👑 Хост комнаты удален');
      }

      // Отправляем информацию об отключении
      io.to(roomId as string).emit('userLeft', {
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