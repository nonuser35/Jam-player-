/* JAM Player v2 - Sync Spotify → YouTube
* Fix: tempo liso + F5 sync + status central
*/

const app = document.getElementById('app');
const bgImage = document.getElementById('bgImage');
const albumArt = document.getElementById('albumArt');
const trackArtist = document.getElementById('trackArtist');
const trackTitle = document.getElementById('trackTitle');
const lyricsLine = document.getElementById('lyricsLine');
const upcomingList = document.getElementById('upcomingList');
const listenersPile = document.getElementById('listenersPile');
const serverStatusText = document.getElementById('serverStatusText');
const connectionIcon = document.getElementById('connectionIcon');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const durationTime = document.getElementById('durationTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiLinkInput = document.getElementById('apiLinkInput');
const connectBtn = document.getElementById('connectBtn');
const connectionIndicator = document.getElementById('connectionIndicator');
const connectionMessage = document.getElementById('connectionMessage');

// ===== API_BASE =====
let API_BASE = '';  // Vazio Python preenche
let syncInterval = null;

// Init API
function initApiBase() {
  const params = new URLSearchParams(location.search);
  const apiUrl = params.get('api');
  if (apiUrl) {
    API_BASE = decodeURIComponent(apiUrl);
    localStorage.setItem('jamApiLink', API_BASE);
    history.replaceState({}, '', location.pathname);
  } else {
    API_BASE = localStorage.getItem('jamApiLink') || '';
  }
  apiLinkInput.value = API_BASE;
  console.log('API:', API_BASE || 'vazia');
}

function isValidApi() {
  return API_BASE && API_BASE.startsWith('http');
}

const HEADERS = { 'ngrok-skip-browser-warning': 'true' };

// ===== PLAYER SYNC =====
let ytPlayer1, ytPlayer2, activePlayer, currentVideoId = '';
let playerReady = false;
let lastProgress = 0, lastDuration = 0;

function formatTime(s) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

function updateProgress(current, duration) {
  if (!duration) return;
  progress.value = (current / duration) * 100;
  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
}

// YT API
function onYouTubeIframeAPIReady() {
  ytPlayer1 = new YT.Player('player1', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
    events: { onReady, onStateChange }
  });
  ytPlayer2 = new YT.Player('player2', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
    events: { onReady, onStateChange }
  });
}

function onReady() {
  playerReady = true;
  activePlayer = ytPlayer1;
  console.log('✅ Player ready');
  startSync();  // Inicia sync F5
}

function onStateChange(e) {
  if (e.data === 0) playNext();  // END → next
}

function loadVideo(id, time = 0) {
  console.log(`🎵 Load ${id} @${time}s`);
  activePlayer.loadVideoById({ videoId: id, startSeconds: time });
  setTimeout(() => activePlayer.seekTo(time, true), 800);  // F5 sync
  currentVideoId = id;
}

// ===== SYNC =====
async function syncStatus() {
  if (!isValidApi()) return;
  
  try {
    const res = await fetch(`${API_BASE}/status`, { headers: HEADERS });
    if (!res.ok) return;
    
    const data = await res.json();
    console.log('📡 Sync:', data.video_id, data.progress/1000);
    
    // UI
    trackTitle.textContent = data.track_name || '';
    trackArtist.textContent = data.artist_name || '';
    albumArt.src = data.cover;
    bgImage.style.backgroundImage = `url(${data.cover})`;
    
    const videoId = String(data.video_id || '').trim();
    const progress = data.progress / 1000;
    const duration = data.duration / 1000;
    
    // Sync vídeo
    if (videoId !== currentVideoId && playerReady) {
      loadVideo(videoId, progress);
    }
    
    // Play/pause
    const state = activePlayer.getPlayerState();
    if (data.is_playing && state !== 1) activePlayer.playVideo();
    else if (!data.is_playing && state === 1) activePlayer.pauseVideo();
    
    updateStatus(true, 'Online');
    lastProgress = progress;
    lastDuration = duration;
    
  } catch (e) {
    console.warn('Sync fail:', e);
    updateStatus(false, 'Offline');
  }
}

function updateStatus(ok, msg) {
  connectionIndicator.style.background = ok ? '#4ade80' : '#ef4444';
  serverStatusText.textContent = msg;
  connectionIcon.textContent = ok ? '🟢' : '🔴';
  connectionMessage.textContent = msg;
}

function startSync() {
  syncStatus();
  syncInterval = setInterval(syncStatus, 1000);
}

// Comandos servidor
async function sendCommand(cmd) {
  if (!isValidApi()) return;
  await fetch(`${API_BASE}/command`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd })
  });
}

prevBtn.onclick = () => sendCommand('prev');
nextBtn.onclick = () => sendCommand('next');

progress.oninput = () => {
  if (activePlayer) {
    const duration = activePlayer.getDuration();
    activePlayer.seekTo((progress.value / 100) * duration, true);
  }
};

connectBtn.onclick = () => {
  API_BASE = apiLinkInput.value.trim();
  if (!API_BASE.startsWith('http')) return alert('URL inválida');
  localStorage.setItem('jamApiLink', API_BASE);
  updateStatus(false, 'Conectando...');
  syncStatus();
};

settingsBtn.onclick = () => settingsPanel.classList.toggle('hidden');

// ===== INIT =====
initApiBase();
setInterval(() => {
  if (activePlayer && playerReady) {
    const current = activePlayer.getCurrentTime() || 0;
    const duration = activePlayer.getDuration() || 0;
    if (duration > 0 && Math.abs(current - lastProgress) < 5) {  // Sync suave
      updateProgress(current, duration);
    }
  }
}, 500);
