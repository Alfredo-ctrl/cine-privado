const socket = io();
let peer = new Peer(); 
const video = document.getElementById('myVideo');
const roomInput = document.getElementById('roomInput');
const fileInput = document.getElementById('fileInput');
const playerDiv = document.getElementById('player');
const loginDiv = document.getElementById('login');

let currentRoom = "";
let isRemoteAction = false;

// 1. Al cargar la web, generamos un ID aleatorio inicial
peer.on('open', (id) => {
    console.log('ID de conexión inicial asignado por PeerJS:', id);
});

// --- FUNCIÓN PARA EL ANFITRIÓN (EL QUE TIENE EL VIDEO) ---
function iniciarComoHost() {
    currentRoom = roomInput.value.trim();
    const file = fileInput.files[0];

    if (!currentRoom || !file) {
        return alert("Por favor, escribe un nombre de sala y selecciona un video.");
    }

    // El truco clave: Reiniciamos PeerJS usando el nombre de la sala como ID
    // Así el invitado sabrá exactamente a quién llamar.
    peer.destroy(); 
    peer = new Peer(currentRoom); 

    peer.on('open', (id) => {
        console.log("Sala abierta. Tu ID es:", id);
        video.src = URL.createObjectURL(file);
        socket.emit('join-room', currentRoom);
        mostrarReproductor();
    });

    // Escuchar cuando el invitado nos llame para pedir el video
    peer.on('call', (call) => {
        console.log("Recibiendo petición de video de un invitado...");
        
        // Capturar el stream (imagen y audio)
        // Algunos navegadores requieren que el video ya se esté reproduciendo
        const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
        
        call.answer(stream); // Enviamos nuestro video al invitado
        console.log("Enviando stream al invitado.");
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            alert("Ese nombre de sala ya está en uso. Elige otro.");
            location.reload();
        } else {
            console.error("Error en Peer (Host):", err);
        }
    });
}

// --- FUNCIÓN PARA EL INVITADO (EL QUE VE EL VIDEO) ---
function iniciarComoInvitado() {
    currentRoom = roomInput.value.trim();
    if (!currentRoom) return alert("Escribe el nombre de la sala para unirte.");

    console.log("Intentando unirse a la sala:", currentRoom);
    socket.emit('join-room', currentRoom);

    // Intentamos llamar al Host (cuyo ID es el nombre de la sala)
    // Ponemos un pequeño delay de 500ms para asegurar que el socket conectó
    setTimeout(() => {
        const call = peer.call(currentRoom, null);

        if (!call) {
            console.error("No se pudo iniciar la llamada.");
            return alert("Error de conexión. Revisa que el Host ya haya creado la sala.");
        }

        call.on('stream', (remoteStream) => {
            console.log("¡Señal de video recibida!");
            video.srcObject = remoteStream;
            
            // Forzamos el play (muchos navegadores bloquean el sonido si no hay clic previo)
            video.play().catch(() => {
                console.log("Reproducción automática bloqueada. Haz clic en el video para verlo.");
            });
        });

        call.on('error', (err) => {
            console.error("Error durante la llamada:", err);
            alert("Hubo un error al recibir el video.");
        });
    }, 500);

    mostrarReproductor();
}

// --- LÓGICA DE SINCRONIZACIÓN (SOCKETS) ---
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
    console.log("Sincronización recibida:", data.action, "en tiempo:", data.time);
    isRemoteAction = true;
    
    // Si la diferencia de tiempo es mucha, ajustamos
    if (Math.abs(video.currentTime - data.time) > 0.5) {
        video.currentTime = data.time;
    }

    if (data.action === 'play') video.play();
    if (data.action === 'pause') video.pause();
    
    // Pequeño margen para evitar rebotes de eventos
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