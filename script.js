// --- REGISTRO DO SERVICE WORKER (PWA) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Service Worker: Ativo"))
    .catch(err => console.log("Service Worker: Erro", err));
}

// --- ESTADO GLOBAL ---
let apiBaseUrl = localStorage.getItem('jam_api_url') || ""; 
let player1, player2, activePlayer, nextPlayer;
let lastVideoId = "";
let syncInterval = null; // Guardar o intervalo para não criar vários
const SYNC_MARGIN = 9;

// --- CAPTURA AUTOMÁTICA DA URL ---
const urlParams = new URLSearchParams(window.location.search);
const apiParam = urlParams.get('api');

if (apiParam) {
    // Remove barra final se existir para evitar //status
    apiBaseUrl = apiParam.replace(/\/$/, ""); 
    localStorage.setItem('jam_api_url', apiBaseUrl);
}

// --- 1. INICIALIZAÇÃO DO YOUTUBE ---
function onYouTubeIframeAPIReady() {
    const config = { 
        height: '0', width: '0', 
        playerVars: { 'controls': 0, 'disablekb': 1, 'autoplay': 1, 'origin': window.location.origin } 
    };
    player1 = new YT.Player('player1', config);
    player2 = new YT.Player('player2', config);
    activePlayer = player1;
    nextPlayer = player2;

    // AUTO-CONECTAR: Se já temos a URL, inicia o loop imediatamente
    if (apiBaseUrl) {
        console.log("> Conectando automaticamente a:", apiBaseUrl);
        const input = document.getElementById('apiLinkInput');
        if(input) input.value = apiBaseUrl;
        iniciarSincronizacao();
    }
}

// --- 2. LOOP DE SINCRONIZAÇÃO ---
function iniciarSincronizacao() {
    if (syncInterval) clearInterval(syncInterval);
    
    // Primeira chamada imediata
    fetchSync();
    // Define o loop de 1.5 segundos
    syncInterval = setInterval(fetchSync, 1500);
    
    // Atualiza a UI para mostrar que está tentando conectar
    const statusMsg = document.getElementById('connectionMessage');
    if (statusMsg) statusMsg.innerText = "Conectado";
    const indicator = document.getElementById('connectionIndicator');
    if (indicator) indicator.className = "connection-indicator connected";
}

async function fetchSync() {
    if (!apiBaseUrl) return;
    try {
        const response = await fetch(`${apiBaseUrl}/status`);
        if (!response.ok) throw new Error("Erro na resposta");
        
        const data = await response.json();
        
        atualizarUI(data);
        gerenciarAudio(data);
        atualizarFila(data.queue);
        atualizarOuvintes(data.usuarios);
        
        if (data.track_name && typeof syncLyrics === "function") {
            syncLyrics(data.track_name, data.artist_name);
        }
    } catch (err) {
        console.error("Erro na busca de dados:", err);
        const statusMsg = document.getElementById('connectionMessage');
        if (statusMsg) statusMsg.innerText = "Reconectando...";
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) indicator.className = "connection-indicator disconnected";
    }
}

// --- 3. LÓGICA DE ÁUDIO ---
function gerenciarAudio(data) {
    if (!data.video_id || !activePlayer || !activePlayer.loadVideoById) return;

    // Se a música mudou
    if (data.video_id !== lastVideoId) {
        lastVideoId = data.video_id;
        console.log("> Nova música detectada, preparando player secundário...");
        
        nextPlayer.loadVideoById(data.video_id, data.progress);
        
        setTimeout(() => {
            activePlayer.stopVideo();
            let temp = activePlayer;
            activePlayer = nextPlayer;
            nextPlayer = temp;
            activePlayer.playVideo();
            
            // Alterna visibilidade se necessário (embora fiquem ocultos)
            document.getElementById('player1').style.opacity = (activePlayer === player1) ? '1' : '0';
            document.getElementById('player2').style.opacity = (activePlayer === player2) ? '1' : '0';
        }, 1000);
        return;
    }

    // Sincronia de tempo
    const meuTempo = activePlayer.getCurrentTime();
    const diff = Math.abs(data.progress - meuTempo);

    if (diff > SYNC_MARGIN) {
        activePlayer.seekTo(data.progress, true);
    }

    // Play/Pause
    if (data.is_playing) {
        if (activePlayer.getPlayerState() !== 1) activePlayer.playVideo();
        document.getElementById('playPauseBtn').classList.add('active');
    } else {
        if (activePlayer.getPlayerState() !== 2) activePlayer.pauseVideo();
        document.getElementById('playPauseBtn').classList.remove('active');
    }
}

// --- 4. INTERFACE ---
function atualizarUI(data) {
    // Títulos e Artista
    document.getElementById('trackTitle').innerText = data.track_name || "Sem música";
    document.getElementById('trackArtist').innerText = data.artist_name || "Desconhecido";
    
    // Capa e Background
    if (data.cover) {
        const art = document.getElementById('albumArt');
        if (art.src !== data.cover) art.src = data.cover;
        document.getElementById('bgImage').style.backgroundImage = `url(${data.cover})`;
    }

    // Barra de Progresso
    if (data.duration > 0) {
        const percent = (data.progress / data.duration) * 100;
        document.getElementById('progress').value = percent;
        document.getElementById('currentTime').innerText = formatTime(data.progress);
        document.getElementById('durationTime').innerText = formatTime(data.duration);
    }
}

function atualizarFila(queue) {
    const list = document.getElementById('upcomingList');
    if (!list || !queue) return;
    list.innerHTML = queue.map(song => `
        <div class="upcoming-item fade-in">
            <img src="${song.cover}" alt="Capa">
            <div class="song-info"><strong>${song.name}</strong><small>${song.artist}</small></div>
        </div>
    `).join('');
}

function atualizarOuvintes(usuarios) {
    const container = document.getElementById('listenersPile');
    if (!container || !usuarios) return;
    container.innerHTML = usuarios.map(u => `
        <div class="user-item" title="${u.name}">
            <img src="${u.photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}">
        </div>
    `).join('');
}

// --- 5. COMANDOS ---
async function enviarComando(cmd, val = null) {
    if (!apiBaseUrl) return;
    try {
        await fetch(`${apiBaseUrl}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, value: val })
        });
    } catch (e) { console.error("Erro ao enviar comando:", cmd); }
}

// --- LISTENERS ---
document.getElementById('connectBtn').addEventListener('click', () => {
    const val = document.getElementById('apiLinkInput').value;
    apiBaseUrl = val.replace(/\/$/, ""); 
    localStorage.setItem('jam_api_url', apiBaseUrl);
    iniciarSincronizacao();
});

document.getElementById('nextBtn').addEventListener('click', () => enviarComando('next'));
document.getElementById('prevBtn').addEventListener('click', () => enviarComando('prev'));
document.getElementById('playPauseBtn').addEventListener('click', function() {
    const isPlaying = this.classList.contains('active');
    enviarComando(isPlaying ? 'pause' : 'play');
});

function formatTime(s) {
    if (!s) return "00:00";
    const min = Math.floor(s / 60);
    const seg = Math.floor(s % 60);
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}
