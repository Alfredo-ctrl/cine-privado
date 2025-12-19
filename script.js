const socket = io();
let peer = new Peer(); 
const video = document.getElementById('myVideo');
const roomInput = document.getElementById('roomInput');
const fileInput = document.getElementById('fileInput');
const playerDiv = document.getElementById('player');
const loginDiv = document.getElementById('login');

let currentRoom = "";
let isRemoteAction = false;

// Al abrir, generamos un ID aleatorio inicial
peer.on('open', (id) => {
    console.log('ID de conexión inicial:', id);
});

// --- FUNCIÓN PARA EL QUE TIENE EL VIDEO (HOST) ---
function iniciarComoHost() {
    currentRoom = roomInput.value.trim();
    const file = fileInput.files[0];

    if (!currentRoom || !file) {
        return alert("Pon un nombre a la sala y selecciona un video.");
    }

    // El truco: destruimos el peer actual y creamos uno nuevo donde el ID es el NOMBRE DE LA SALA
    peer.destroy();
    peer = new Peer(currentRoom);

    peer.on('open', (id) => {
        console.log("Sala creada. Tu ID ahora es:", id);
        video.src = URL.createObjectURL(file);
        socket.emit('join-room', currentRoom);
        mostrarReproductor();
    });

    peer.on('call', (call) => {
        console.log("¡Alguien se está uniendo! Enviando señal de video...");
        // Capturar stream del video
        const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
        call.answer(stream);
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            alert("Ese nombre de sala ya existe. Usa uno diferente.");
            location.reload();
        }
    });
}

// --- FUNCIÓN PARA EL QUE VE EL VIDEO (INVITADO) ---
function iniciarComoInvitado() {
    currentRoom = roomInput.value.trim();
    if (!currentRoom) return alert("Escribe el nombre de la sala de tu amigo.");

    console.log("Intentando conectar a la sala:", currentRoom);
    socket.emit('join-room', currentRoom);

    // Llamamos al ID que coincide con el nombre de la sala
    const call = peer.call(currentRoom, null);

    call.on('stream', (remoteStream) => {
        console.log("Stream recibido correctamente.");
        video.srcObject = remoteStream;
        // El navegador a veces bloquea el auto-play, forzamos play
        video.play().catch(e => console.log("Haz clic en la pantalla para activar el video"));
    });

    mostrarReproductor();
}

// --- SINCRONIZACIÓN ---
video.onplay = () => sync('play');
video.onpause = () => sync('pause');
video.onseeking = () => sync('seek');

function sync(action) {
    if (isRemoteAction) return;
    socket.emit('video-sync', {
        room: currentRoom,
        action: action,
        time: video.currentTime
    });
}

socket.on('video-sync', (data) => {
    console.log("Orden remota recibida:", data.action);
    isRemoteAction = true;
    video.currentTime = data.time;
    if (data.action === 'play') video.play();
    if (data.action === 'pause') video.pause();
    setTimeout(() => { isRemoteAction = false; }, 600);
});

// --- CHAT ---
function enviarComentario() {
    const input = document.getElementById('chatInput');
    if (!input.value) return;
    socket.emit('chat-msg', { room: currentRoom, text: input.value });
    crearBurbuja(input.value);
    input.value = "";
}

socket.on('chat-msg', (text) => {
    crearBurbuja(text);
});

function crearBurbuja(texto) {
    const area = document.getElementById('comentarios-area');
    const b = document.createElement('div');
    b.className = 'comentario';
    b.innerText = texto;
    b.style.top = Math.random() * 70 + 5 + "%";
    area.appendChild(b);
    setTimeout(() => b.remove(), 4000);
}

function mostrarReproductor() {
    loginDiv.style.display = 'none';
    playerDiv.style.display = 'block';
}