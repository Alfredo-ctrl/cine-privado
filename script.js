const socket = io();
let peer = new Peer(); 
const video = document.getElementById('myVideo');
const roomInput = document.getElementById('roomInput');
const fileInput = document.getElementById('fileInput');
const playerDiv = document.getElementById('player');
const loginDiv = document.getElementById('login');

let currentRoom = "";
let isRemoteAction = false;

// 1. Configuración inicial de PeerJS
peer.on('open', (id) => {
    console.log('ID de conexión listo:', id);
});

// --- FUNCIÓN PARA EL ANFITRIÓN (HOST) ---
function iniciarComoHost() {
    currentRoom = roomInput.value.trim();
    const file = fileInput.files[0];

    if (!currentRoom || !file) return alert("Pon nombre a la sala y elige un video.");

    peer.destroy(); 
    peer = new Peer(currentRoom); 

    peer.on('open', (id) => {
        video.src = URL.createObjectURL(file);
        socket.emit('join-room', currentRoom);
        mostrarReproductor();
        console.log("Sala de Host lista:", id);
    });

    peer.on('call', (call) => {
        console.log("Enviando video al invitado...");
        const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
        call.answer(stream);
    });
}

// --- FUNCIÓN PARA EL INVITADO (GUEST) ---
async function iniciarComoInvitado() {
    currentRoom = roomInput.value.trim();
    if (!currentRoom) return alert("Escribe el nombre de la sala.");

    socket.emit('join-room', currentRoom);
    mostrarReproductor();

    const intentarConexion = () => {
        const call = peer.call(currentRoom, null);

        if (!call) {
            setTimeout(intentarConexion, 2000);
            return;
        }

        call.on('stream', (remoteStream) => {
            console.log("¡Señal recibida!");
            video.srcObject = remoteStream;
            
            // TRUCO MAESTRO: Entrar silenciado para que el navegador NO bloquee el video
            video.muted = true; 
            
            video.play().catch(() => {
                console.log("Bloqueo de autoplay detectado.");
            });
        });
    };

    if (peer.open) intentarConexion();
    else peer.on('open', intentarConexion);
}

// --- SINCRONIZACIÓN DE VIDEO ---
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
    isRemoteAction = true;
    
    // Ajustar tiempo solo si la diferencia es notable (>0.5s)
    if (Math.abs(video.currentTime - data.time) > 0.5) {
        video.currentTime = data.time;
    }

    if (data.action === 'play') video.play();
    if (data.action === 'pause') video.pause();
    
    setTimeout(() => { isRemoteAction = false; }, 600);
});

// --- CHAT FLOTANTE ---
function enviarComentario() {
    const input = document.getElementById('chatInput');
    if (!input.value) return;
    socket.emit('chat-msg', { room: currentRoom, text: input.value });
    crearBurbuja(input.value);
    input.value = "";
}

socket.on('chat-msg', (text) => crearBurbuja(text));

function crearBurbuja(texto) {
    const area = document.getElementById('comentarios-area');
    const b = document.createElement('div');
    b.className = 'comentario';
    b.innerText = texto;
    b.style.top = Math.random() * 70 + 10 + "%";
    area.appendChild(b);
    setTimeout(() => b.remove(), 4000);
}

function mostrarReproductor() {
    loginDiv.style.display = 'none';
    playerDiv.style.display = 'block';
}