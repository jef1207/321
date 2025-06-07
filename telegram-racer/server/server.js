const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Хранилище игроков и комнат
const players = {};
const rooms = {};

io.on('connection', (socket) => {
  console.log(`Новое подключение: ${socket.id}`);

  // Регистрация игрока
  socket.on('register', (playerData) => {
    players[socket.id] = {
      id: socket.id,
      name: playerData.name,
      room: null,
      x: 100,
      y: 500,
      angle: 0,
      speed: 0,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    };
    socket.emit('registered', players[socket.id]);
  });

  // Создание комнаты
  socket.on('create-room', () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomId] = {
      id: roomId,
      players: [socket.id],
      status: 'waiting'
    };
    players[socket.id].room = roomId;
    socket.join(roomId);
    socket.emit('room-created', roomId);
  });

  // Присоединение к комнате
  socket.on('join-room', (roomId) => {
    if (rooms[roomId] && rooms[roomId].players.length < 4) {
      rooms[roomId].players.push(socket.id);
      players[socket.id].room = roomId;
      socket.join(roomId);
      io.to(roomId).emit('player-joined', players[socket.id]);
      
      // Старт игры при 2+ игроках
      if (rooms[roomId].players.length >= 2) {
        rooms[roomId].status = 'racing';
        io.to(roomId).emit('game-start');
      }
    } else {
      socket.emit('room-error', 'Комната заполнена или не существует');
    }
  });

  // Обновление состояния игрока
  socket.on('update', (playerState) => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...playerState };
      const roomId = players[socket.id].room;
      if (roomId) {
        socket.to(roomId).emit('player-updated', players[socket.id]);
      }
    }
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    if (players[socket.id]) {
      const roomId = players[socket.id].room;
      if (roomId && rooms[roomId]) {
        rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
        io.to(roomId).emit('player-left', socket.id);
        
        if (rooms[roomId].players.length === 0) {
          delete rooms[roomId];
        }
      }
      delete players[socket.id];
    }
  });
});

// Проверка коллизий
setInterval(() => {
  for (const roomId in rooms) {
    if (rooms[roomId].status === 'racing') {
      const playerIds = rooms[roomId].players;
      
      // Проверка столкновений между игроками
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const p1 = players[playerIds[i]];
          const p2 = players[playerIds[j]];
          
          if (p1 && p2 && isColliding(p1, p2)) {
            io.to(roomId).emit('collision', {
              player1: p1.id,
              player2: p2.id
            });
          }
        }
      }
    }
  }
}, 100);

function isColliding(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy) < 40;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
