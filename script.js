// --- REGISTRO DO SERVICE WORKER (PWA) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Service Worker: Ativo"))
    .catch(err => console.log("Service Worker: Erro", err));
}

// --- ESTADO GLOBAL E AUTO-LOAD ---
let apiBaseUrl = localStorage.getItem('jam_api_url') || ""; 
let player1, player2, activePlayer, nextPlayer;
let lastVideoId = "";
const SYNC_MARGIN = 9;

// Lógica de Captura Automática da URL do Python
const urlParams = new URLSearchParams(window.location.search);
const apiParam = urlParams.get('api');

if (apiParam) {
    apiBaseUrl = apiParam;
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

    // Se já tivermos a API, conecta automaticamente após o YT carregar
    if (apiBaseUrl) {
        setTimeout(() => {
            document.getElementById('apiLinkInput').value = apiBaseUrl;
            document.getElementById('connectBtn').click();
        }, 1500);
    }
}

// --- 2. LOOP PRINCIPAL (SINCRONIA) ---
async function fetchSync() {
    if (!apiBaseUrl) return;
    try {
        const response = await fetch(`${apiBaseUrl}/status`);
        const data = await response.json();
        atualizarUI(data);
        gerenciarAudio(data);
        atualizarFila(data.queue);
        atualizarOuvintes(data.usuarios);
        if (data.track_name && typeof syncLyrics === "function") syncLyrics(data.track_name, data.artist_name);
    } catch (err) {
        document.getElementById('serverStatusText').innerText = "Reconectando...";
    }
}

// --- 3. LÓGICA DE ÁUDIO ---
function gerenciarAudio(data) {
    if (!data.video_id) return;
    if (data.video_id !== lastVideoId) {
        lastVideoId = data.video_id;
        nextPlayer.loadVideoById(data.video_id, data.progress);
        setTimeout(() => {
            activePlayer.stopVideo();
            let temp = activePlayer;
            activePlayer = nextPlayer;
            nextPlayer = temp;
            activePlayer.playVideo();
            document.getElementById('player1').style.display = (activePlayer === player1) ? 'block' : 'none';
            document.getElementById('player2').style.display = (activePlayer === player2) ? 'block' : 'none';
        }, 1000);
        return;
    }
    const meuTempo = activePlayer.getCurrentTime();
    const diff = Math.abs(data.progress - meuTempo);
    if (diff > SYNC_MARGIN) {
        activePlayer.seekTo(data.progress, true);
        activePlayer.setPlaybackRate(1.05);
        setTimeout(() => activePlayer.setPlaybackRate(1.0), 2000);
    } else {
        activePlayer.setPlaybackRate(1.0);
    }
    if (data.is_playing) {
        activePlayer.playVideo();
        document.getElementById('playPauseBtn').classList.add('active');
    } else {
        activePlayer.pauseVideo();
        document.getElementById('playPauseBtn').classList.remove('active');
    }
}

// --- 4. INTERFACE ---
function atualizarUI(data) {
    document.getElementById('trackTitle').innerText = data.track_name || "Sem música";
    document.getElementById('trackArtist').innerText = data.artist_name || "Desconhecido";
    document.getElementById('serverStatusText').innerText = data.is_playing ? "Tocando agora" : "Pausado";
    document.getElementById('connectionIndicator').className = "connection-indicator connected";
    if (data.cover) {
        document.getElementById('albumArt').src = data.cover;
        document.getElementById('bgImage').style.backgroundImage = `url(${data.cover})`;
    }
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
        <div class="user-item" data-name="${u.name}"><img src="${u.photo || 'default-avatar.png'}"></div>
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
    } catch (e) { console.error("Erro no comando"); }
}

// Listeners
document.getElementById('connectBtn').addEventListener('click', () => {
    apiBaseUrl = document.getElementById('apiLinkInput').value;
    localStorage.setItem('jam_api_url', apiBaseUrl);
    document.getElementById('connectionMessage').innerText = "Conectado";
    setInterval(fetchSync, 1500);
});

document.getElementById('volumeSlider').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    activePlayer.setVolume(v * 100);
    enviarComando('volume', v * 100);
});

document.getElementById('nextBtn').addEventListener('click', () => enviarComando('next'));
document.getElementById('prevBtn').addEventListener('click', () => enviarComando('prev'));
document.getElementById('playPauseBtn').addEventListener('click', () => {
    const isPlaying = document.getElementById('playPauseBtn').classList.contains('active');
    enviarComando(isPlaying ? 'pause' : 'play');
});

// Abas e Painéis
document.getElementById('settingsBtn').addEventListener('click', () => document.getElementById('settingsPanel').classList.toggle('hidden'));
document.querySelectorAll('.section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.section-btn, .section-panel').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector(`.section-panel[data-section="${btn.dataset.section}"]`).classList.add('active');
    });
});

function formatTime(s) {
    const min = Math.floor(s / 60);
    const seg = Math.floor(s % 60);
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}
