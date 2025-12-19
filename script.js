const socket = io();
let peer = new Peer(); 
const video = document.getElementById('myVideo');
const roomInput = document.getElementById('roomInput');
const fileInput = document.getElementById('fileInput');
const playerDiv = document.getElementById('player');
const loginDiv = document.getElementById('login');

let currentRoom = "";
let isRemoteAction = false;

// Al cargar, PeerJS nos asigna un ID temporal
peer.on('open', (id) => {
    console.log('Conexión inicial establecida. ID temporal:', id);
});

// --- FUNCIÓN PARA EL ANFITRIÓN (HOST) ---
function iniciarComoHost() {
    currentRoom = roomInput.value.trim();
    const file = fileInput.files[0];

    if (!currentRoom || !file) {
        return alert("Por favor, escribe un nombre de sala y selecciona un video.");
    }

    // Reiniciamos PeerJS para usar el nombre de la sala como nuestra dirección
    peer.destroy(); 
    peer = new Peer(currentRoom); 

    peer.on('open', (id) => {
        console.log("Sala creada. Tu dirección es:", id);
        video.src = URL.createObjectURL(file);
        socket.emit('join-room', currentRoom);
        mostrarReproductor();
    });

    peer.on('call', (call) => {
        console.log("Un invitado está solicitando el video...");
        // Capturamos el video. Importante: debe estar en Play para que funcione mejor
        const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
        call.answer(stream);
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            alert("Ese nombre de sala ya existe. Prueba con otro.");
            location.reload();
        }
    });
}

// --- FUNCIÓN PARA EL INVITADO (GUEST) ---
async function iniciarComoInvitado() {
    currentRoom = roomInput.value.trim();
    if (!currentRoom) return alert("Escribe el nombre de la sala.");

    console.log("Intentando entrar a la sala:", currentRoom);
    socket.emit('join-room', currentRoom);
    mostrarReproductor();

    // Lógica de reintento automático
    const intentarConexion = () => {
        console.log("Buscando al Host...");
        const call = peer.call(currentRoom, null);

        if (!call) {
            console.log("El Host no responde aún. Reintentando en 2 segundos...");
            setTimeout(intentarConexion, 2000);
            return;
        }

        call.on('stream', (remoteStream) => {
            console.log("¡Señal de video recibida!");
            video.srcObject = remoteStream;
            video.play().catch(() => {
                console.log("Reproducción bloqueada por el navegador. Toca la pantalla.");
            });
        });

        call.on('error', (err) => {
            console.log("Error en la llamada, reintentando...");
            setTimeout(intentarConexion, 2000);
        });
    };

    // Aseguramos que nuestra conexión esté lista antes de llamar
    if (peer.open) {
        intentarConexion();
    } else {
        peer.on('open', intentarConexion);
    }
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
    
    // Si la diferencia es mayor a medio segundo, corregimos posición
    if (Math.abs(video.currentTime - data.time) > 0.5) {
        video.currentTime = data.time;
    }

    if (data.action === 'play') video.play();
    if (data.action === 'pause') video.pause();
    
    setTimeout(() => { isRemoteAction = false; }, 600);
});

// --- COMENTARIOS FLOTANTES ---
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
    b.style.top = Math.random() * 70 + 10 + "%";
    area.appendChild(b);
    setTimeout(() => b.remove(), 4000);
}

function mostrarReproductor() {
    loginDiv.style.display = 'none';
    playerDiv.style.display = 'block';
}