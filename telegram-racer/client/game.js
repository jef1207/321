// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

const socket = io('http://localhost:3000'); // Замените на ваш URL сервера
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Настройка размеров
canvas.width = window.innerWidth * 0.9;
canvas.height = window.innerHeight * 0.7;

// Элементы интерфейса
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const createBtn = document.getElementById('create-room');
const joinBtn = document.getElementById('join-room');
const roomInput = document.getElementById('room-code');
const playersList = document.getElementById('players-list');
const playersStatus = document.getElementById('players-status');
const leaveBtn = document.getElementById('leave-room');

// Данные игрока
let player = {
    id: null,
    name: tg.initDataUnsafe.user?.first_name || 'Гонщик',
    x: 100,
    y: 500,
    angle: 0,
    speed: 0,
    color: '#e74c3c'
};

// Состояние игры
let gameState = {
    players: {},
    room: null,
    status: 'waiting' // waiting, racing, finished
};

// Регистрация игрока
socket.emit('register', { name: player.name });

// Обработчики событий
createBtn.addEventListener('click', () => {
    socket.emit('create-room');
});

joinBtn.addEventListener('click', () => {
    const roomCode = roomInput.value.trim();
    if (roomCode) {
        socket.emit('join-room', roomCode);
    }
});

leaveBtn.addEventListener('click', () => {
    socket.emit('leave-room');
    gameScreen.classList.remove('active');
    startScreen.classList.add('active');
});

// Сокет-события
socket.on('registered', (data) => {
    player = { ...player, ...data };
});

socket.on('room-created', (roomId) => {
    roomInput.value = roomId;
    playersList.innerHTML = `<div class="player-badge">${player.name} (Вы)</div>`;
});

socket.on('player-joined', (newPlayer) => {
    playersList.innerHTML += `<div class="player-badge">${newPlayer.name}</div>`;
});

socket.on('game-start', () => {
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    gameLoop();
});

socket.on('player-updated', (updatedPlayer) => {
    if (updatedPlayer.id !== player.id) {
        gameState.players[updatedPlayer.id] = updatedPlayer;
    }
});

socket.on('player-left', (playerId) => {
    delete gameState.players[playerId];
    updatePlayersStatus();
});

socket.on('collision', (data) => {
    if (data.player1 === player.id || data.player2 === player.id) {
        player.speed = 0;
        // Анимация взрыва
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
        ctx.fill();
    }
});

// Управление
document.addEventListener('keydown', (e) => {
    if (gameScreen.classList.contains('active')) {
        if (e.key === 'ArrowLeft') player.angle -= 0.1;
        if (e.key === 'ArrowRight') player.angle += 0.1;
        if (e.key === 'ArrowUp') player.speed = 5;
        if (e.key === 'ArrowDown') player.speed = -2;
        
        socket.emit('update', {
            x: player.x,
            y: player.y,
            angle: player.angle,
            speed: player.speed
        });
    }
});

// Игровой цикл
function gameLoop() {
    if (gameScreen.classList.contains('active')) {
        // Обновление позиции игрока
        player.x += player.speed * Math.cos(player.angle);
        player.y += player.speed * Math.sin(player.angle);
        
        // Ограничение скорости
        if (player.speed > 0) player.speed -= 0.1;
        if (player.speed < 0) player.speed += 0.1;
        
        // Границы холста
        if (player.x < 20) player.x = 20;
        if (player.x > canvas.width - 20) player.x = canvas.width - 20;
        if (player.y < 20) player.y = 20;
        if (player.y > canvas.height - 20) player.y = canvas.height - 20;
        
        // Отрисовка
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Трасса
        ctx.fillStyle = '#34495e';
        ctx.fillRect(50, 50, canvas.width - 100, canvas.height - 100);
        
        // Другие игроки
        for (const id in gameState.players) {
            drawCar(gameState.players[id]);
        }
        
        // Игрок
        drawCar(player);
        
        updatePlayersStatus();
        requestAnimationFrame(gameLoop);
    }
}

function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    
    // Кузов
    ctx.fillStyle = car.color;
    ctx.fillRect(-15, -10, 30, 20);
    
    // Окна
    ctx.fillStyle = '#3498db';
    ctx.fillRect(-5, -8, 15, 16);
    
    // Колеса
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-12, -12, 6, 6);
    ctx.fillRect(6, -12, 6, 6);
    ctx.fillRect(-12, 6, 6, 6);
    ctx.fillRect(6, 6, 6, 6);
    
    ctx.restore();
}

function updatePlayersStatus() {
    playersStatus.innerHTML = '';
    for (const id in gameState.players) {
        playersStatus.innerHTML += `
            <div class="player-status" style="color:${gameState.players[id].color}">
                ${gameState.players[id].name}: ${Math.floor(gameState.players[id].speed * 10)} км/ч
            </div>
        `;
    }
    playersStatus.innerHTML += `
        <div class="player-status" style="color:${player.color}">
            ${player.name} (Вы): ${Math.floor(player.speed * 10)} км/ч
        </div>
    `;
}
