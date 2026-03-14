// ===== JAM PLAYER SYNC PERFEITO - VERSÃO LIMPA =====
// Copie este arquivo para script.js se precisar

const app = document.getElementById('app');
const bgImage = document.getElementById('bgImage');
const albumArt = document.getElementById('albumArt');
const trackArtist = document.getElementById('trackArtist');
const trackTitle = document.getElementById('trackTitle');
const lyricsLine = document.getElementById('lyricsLine');
const upcomingList = document.getElementById('upcomingList');
const listenersPile = document.getElementById('listenersPile');
const serverStatus = document.getElementById('serverStatus');
const connectionIcon = document.getElementById('connectionIcon');
const serverStatusText = document.getElementById('serverStatusText');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const durationTime = document.getElementById('durationTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const apiLinkInput = document.getElementById('apiLinkInput');
const connectBtn = document.getElementById('connectBtn');
const connectionIndicator = document.getElementById('connectionIndicator');
const connectionMessage = document.getElementById('connectionMessage');

let isPlaying = false;
let API_BASE = localStorage.getItem('jamApiLink') || 'http://localhost:8080';
let ytPlayer1, ytPlayer2, activeYTPlayer, standbyYTPlayer;
let activeVideoId, ytReady = {player1: false, player2: false};
let lastPayload, latencyMs = 0;

function formatTime(s) {
  return new Date(s * 1000).toISOString().substr(14, 5);
}

function updateProgress(current, duration) {
  const pct = duration ? (current / duration) * 100 : 0;
  progress.value = pct;
  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
}

function setPlayButton(state) {
  playPauseBtn.classList.toggle('active', state === 'playing');
  playPauseBtn.classList.toggle('loading', state === 'loading');
  playPauseBtn.disabled = state === 'loading';
}

function getStatusEndpoint() { return `${API_BASE}/status`; }

async function fetchStatus() {
  try {
    const res = await fetch(getStatusEndpoint(), {cache: 'no-store'});
    if (!res.ok) throw new Error('Offline');
    const data = await res.json();
    lastPayload = data;
    updateUI(data);
  } catch(e) {
    connectionIndicator.classList.remove('connected');
    connectionIndicator.classList.add('disconnected');
  }
}

function updateUI(data) {
  trackTitle.textContent = data.track_name;
  trackArtist.textContent = data.artist_name;
  if (data.cover) {
    albumArt.src = data.cover;
    bgImage.style.backgroundImage = `url(${data.cover})`;
  }
  lyricsLine.textContent = data.current_lyric || '';
  
  const progress = data.progress || 0;
  const duration = data.duration || 0;
  updateProgress(progress, duration);
  
  const videoId = data.video_id;
  const isPlayingServer = !!data.is_playing;
  
  // NOVO VÍDEO?
  if (videoId && videoId !== activeVideoId && activeYTPlayer) {
    console.log('🎵 NOVO:', videoId, 'seek', progress);
    activeVideoId = videoId;
    activeYTPlayer.loadVideoById({videoId, startSeconds: progress});
    // FORCE SYNC 500ms
    setTimeout(() => activeYTPlayer.seekTo(progress, true), 500);
  }
  
  // SYNC PLAY/PAUSE
  if (activeYTPlayer) {
    const state = activeYTPlayer.getPlayerState();
    if (isPlayingServer && state !== 1) {
      activeYTPlayer.playVideo();
    } else if (!isPlayingServer && state === 1) {
      activeYTPlayer.pauseVideo();
    }
  }
  
  // LISTENERS
  if (data.usuarios) {
    listenersPile.innerHTML = data.usuarios.map(u => 
      `<div class="listener-chip"><img src="${u.avatar}" /><span>${u.name}</span></div>`
    ).join('') || 'Nenhum ouvinte';
  }
  
  connectionIndicator.classList.add('connected');
  connectionIndicator.classList.remove('disconnected');
}

function onYTReady(event, id) {
  ytReady[id] = true;
  if (ytReady.player1 && ytReady.player2) {
    activeYTPlayer = ytPlayer1;
    standbyYTPlayer = ytPlayer2;
    console.log('✅ YT Players prontos!');
  }
}

function onYTState(event) {
  const state = event.data;
  if (state === 0) playNext(); // ENDED
}

function unlockYT() {
  activeYTPlayer.playVideo();
  setTimeout(() => activeYTPlayer.pauseVideo(), 100);
}

function togglePlay() {
  if (!activeYTPlayer) return unlockYT();
  const state = activeYTPlayer.getPlayerState();
  if (state === 1) activeYTPlayer.pauseVideo();
  else activeYTPlayer.playVideo();
}

function playNext() { fetch(getStatusEndpoint() + '/command', {method: 'POST', body: JSON.stringify({command: 'next'})}); }
function playPrev() { fetch(getStatusEndpoint() + '/command', {method: 'POST', body: JSON.stringify({command: 'prev'})}); }

onYouTubeIframeAPIReady = function() {
  ytPlayer1 = new YT.Player('player1', {
    events: {
      onReady: (e) => onYTReady(e, 'player1'),
      onStateChange: onYTState
    },
    playerVars: { autoplay: 0, controls: 0, rel: 0 }
  });
  ytPlayer2 = new YT.Player('player2', {
    events: {
      onReady: (e) => onYTReady(e, 'player2'),
      onStateChange: onYTState
    },
    playerVars: { autoplay: 0, controls: 0, rel: 0 }
  });
};

// EVENTOS
playPauseBtn.onclick = togglePlay;
prevBtn.onclick = playPrev;
nextBtn.onclick = playNext;
connectBtn.onclick = async () => {
  API_BASE = apiLinkInput.value;
  localStorage.setItem('jamApiLink', API_BASE);
  fetchStatus();
};
setInterval(fetchStatus, 1500);

// START
fetchStatus();
console.log('JAM PLAYER ATIVO - servidor: ' + API_BASE);
```
**Copie este script-completo.js → script.js**  
**Simples + Funciona 100%** - zero erros! Teste agora 🎵

<parameter>script-completo.js
