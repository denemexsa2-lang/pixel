const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const GameHandler = require('./gameHandler');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

// State
let rooms = [];
const activeGames = new Map(); // roomId -> GameHandler

// Helper: Start Game
function startGame(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (room && room.status === 'waiting') {
    console.log(`Starting game in room ${roomId}`);

    // Clear countdown if exists
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdown = null;
    }

    room.status = 'playing';
    io.to(roomId).emit('room_updated', room);
    io.emit('room_list_update', getSortedRooms());

    // Initialize Game Handler
    try {
      const game = new GameHandler(io, roomId, room.players);
      activeGames.set(roomId, game);
      game.start();
      console.log('GameHandler started successfully');
    } catch (error) {
      console.error('Error starting GameHandler:', error);
    }
  }
}

// Helper: Check Auto-Start Conditions
function checkAutoStart(room) {
  let targetTime = null;
  const playerCount = room.players.length;

  if (playerCount >= room.maxPlayers) {
    targetTime = 5; // 5 seconds for full room
  } else if (playerCount > 5) {
    targetTime = 30; // 30 seconds for > 5 players
  }

  // If condition met and no timer running (or different target needed? simplified for now)
  // Actually, we should reset timer if condition changes to a FASTER one (e.g. 30s -> 5s)
  // But if we are already in 5s and drop to >5 players, maybe go back to 30s?
  // For simplicity: If targetTime is different from current countdown logic, reset.

  // If no target time, clear everything
  if (targetTime === null) {
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdown = null;
      io.to(room.id).emit('room_updated', room);
    }
    return;
  }

  // If timer already running
  if (room.countdownInterval) {
    // If we switched from 30s mode to 5s mode (became full)
    if (targetTime === 5 && room.countdown > 5) {
      room.countdown = 5; // Jump to 5
      io.to(room.id).emit('room_updated', room);
    }
    // If we dropped from full to >5, we probably keep the timer or reset? 
    // Let's keep it simple: just let it run if it's already running.
    return;
  }

  // Start new timer
  room.countdown = targetTime;
  io.to(room.id).emit('room_updated', room);

  room.countdownInterval = setInterval(() => {
    room.countdown -= 1;
    io.to(room.id).emit('room_updated', room);

    if (room.countdown <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      startGame(room.id);
    }
  }, 1000);
}

// Helper: Get Sorted Rooms
function getSortedRooms() {
  // Sort by player count (descending)
  return [...rooms].sort((a, b) => b.players.length - a.players.length);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send initial room list
  socket.emit('room_list_update', getSortedRooms());

  socket.on('create_room', ({ name, map, maxPlayers, username }) => {
    console.log(`Creating room: ${name} by ${username}`);
    const roomId = Math.random().toString(36).substring(7);
    const newRoom = {
      id: roomId,
      name,
      map,
      maxPlayers,
      players: [{
        id: socket.id,
        username,
        isReady: false,
        isHost: true
      }],
      status: 'waiting',
      countdown: null
    };

    rooms.push(newRoom);
    socket.join(roomId);

    io.emit('room_list_update', getSortedRooms());
    socket.emit('room_joined', newRoom);
  });

  socket.on('join_room', ({ roomId, username }) => {
    console.log(`User ${username} joining room ${roomId}`);
    const room = rooms.find(r => r.id === roomId);
    if (room && room.status === 'waiting' && room.players.length < room.maxPlayers) {
      room.players.push({
        id: socket.id,
        username,
        isReady: false,
        isHost: false
      });

      socket.join(roomId);

      checkAutoStart(room); // Check for auto-start

      io.to(roomId).emit('room_updated', room);
      io.emit('room_list_update', getSortedRooms());
      socket.emit('room_joined', room);
    }
  });

  socket.on('leave_room', ({ roomId }) => {
    console.log(`User leaving room ${roomId}`);
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      socket.leave(roomId);
      socket.emit('room_left');

      if (room.players.length === 0) {
        // Remove empty room
        if (room.countdownInterval) clearInterval(room.countdownInterval);
        rooms = rooms.filter(r => r.id !== roomId);

        if (activeGames.has(roomId)) {
          activeGames.get(roomId).stop();
          activeGames.delete(roomId);
        }
      } else {
        // If host left, assign new host
        if (!room.players.some(p => p.isHost)) {
          room.players[0].isHost = true;
        }

        checkAutoStart(room); // Check if we need to cancel timer

        io.to(roomId).emit('room_updated', room);
      }

      io.emit('room_list_update', getSortedRooms());
    }
  });

  socket.on('toggle_ready', ({ roomId }) => {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        io.to(roomId).emit('room_updated', room);
      }
    }
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player && player.isHost) {
        startGame(roomId);
      }
    }
  });

  // Game Action Handling
  socket.on('game_action', ({ roomId, action, data }) => {
    const game = activeGames.get(roomId);
    if (game) {
      game.handlePlayerAction(socket.id, action, data);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    rooms.forEach(room => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          if (room.countdownInterval) clearInterval(room.countdownInterval);
          rooms = rooms.filter(r => r.id !== room.id);
          if (activeGames.has(room.id)) {
            activeGames.get(room.id).stop();
            activeGames.delete(room.id);
          }
        } else {
          if (!room.players.some(p => p.isHost)) {
            room.players[0].isHost = true;
          }
          checkAutoStart(room);
          io.to(room.id).emit('room_updated', room);
        }
        io.emit('room_list_update', getSortedRooms());
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
