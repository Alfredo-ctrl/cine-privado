const socket = io();
const peer = new Peer(); // Crea una identidad única para la conexión de video
const video = document.getElementById('myVideo');
const roomInput = document.getElementById('roomInput');
const fileInput = document.getElementById('fileInput');
const playerDiv = document.getElementById('player');
const loginDiv = document.getElementById('login');

let currentRoom = "";
let isRemoteAction = false; // Evita que se cree un bucle infinito de pausas

// --- 1. CONFIGURACIÓN INICIAL ---

// Al abrir la app, PeerJS nos da un ID único. Lo usaremos como nombre de sala si no pones uno.
peer.on('open', (id) => {
    console.log('Tu ID de conexión es: ' + id);
});

// --- 2. LÓGICA DEL ANFITRIÓN (El que tiene el video) ---

function iniciarComoHost() {
    currentRoom = roomInput.value || "sala-secreta";
    const file = fileInput.files[0];

    if (!file) return alert("Por favor, selecciona un video primero.");

    // Cargar video localmente
    video.src = URL.createObjectURL(file);
    
    // Avisar al servidor que creamos una sala
    socket.emit('join-room', currentRoom);

    // Escuchar cuando alguien se conecte para enviarle el video
    peer.on('call', (call) => {
        // Capturamos el flujo del video (imagen y sonido)
        const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
        call.answer(stream); 
    });

    mostrarReproductor();
}

// --- 3. LÓGICA DEL INVITADO (El que ve el video de otro) ---

function iniciarComoInvitado() {
    currentRoom = roomInput.value || "sala-secreta";
    if (!currentRoom) return alert("Escribe el nombre de la sala de tu amigo");

    socket.emit('join-room', currentRoom);

    // Llamamos al amigo usando el nombre de la sala como ID de Peer
    // (Para simplificar, el Peer ID debe ser igual al nombre de la sala)
    const call = peer.call(currentRoom, null); 
    
    call.on('stream', (remoteStream) => {
        video.srcObject = remoteStream;
        video.play();
    });

    mostrarReproductor();
}

// --- 4. SINCRONIZACIÓN EN TIEMPO REAL ---

// Enviar pausa/play al otro
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

// Recibir pausa/play del otro
socket.on('video-sync', (data) => {
    isRemoteAction = true;
    video.currentTime = data.time;
    if (data.action === 'play') video.play();
    if (data.action === 'pause') video.pause();
    
    setTimeout(() => { isRemoteAction = false; }, 500);
});

// --- 5. COMENTARIOS FLOTANTES ---

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
    b.style.top = Math.random() * 80 + "%"; // Aparece en altura aleatoria
    area.appendChild(b);
    setTimeout(() => b.remove(), 4000); // Se borra tras la animación
}

function mostrarReproductor() {
    loginDiv.style.display = 'none';
    playerDiv.style.display = 'block';
}