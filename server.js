const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Compartir la carpeta actual para que el navegador vea el HTML, CSS y JS
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('Alguien se ha conectado ID:', socket.id);

    // Unirse a una sala privada
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Usuario unido a la sala: ${roomId}`);
    });

    // Recibir órdenes del video (play, pausa, tiempo) y enviarlas al otro
    socket.on('video-sync', (data) => {
        // Enviamos a todos en la sala EXCEPTO al que mandó la orden
        socket.to(data.room).emit('video-sync', data);
    });

    // Recibir comentarios flotantes
    socket.on('chat-msg', (data) => {
        socket.to(data.room).emit('chat-msg', data.text);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor listo en: http://localhost:${PORT}`);
});