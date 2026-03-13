/* JAM Player - Player YouTube manual
* Sem sync servidor - só UI + comandos
* Python só fila/status/UI
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

// API_BASE
let API_BASE = '';
let syncInterval = null;

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
}

function isValidApi() {
  return API_BASE && API_BASE.startsWith('http');
}

const HEADERS = { 'ngrok-skip-browser-warning': 'true' };

// Player YouTube MANUAL
let ytPlayer;
let currentVideoId = '';

function formatTime(s) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

function updateProgress(current, duration) {
  if (!duration) return;
  progress.value = (current / duration) * 100;
  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
}

// YT API simplificado (1 player)
function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('player1', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
    events: { onReady, onStateChange }
  });
}

function onReady() {
  console.log('🎵 Player pronto');
}

function onStateChange(e) {
  if (e.data === 1) onVideoLoaded(ytPlayer.getDuration());  // PLAYING → set duration 1x
  if (e.data === 0) nextBtn.click();
}

function loadVideo(id) {
  console.log('🎵 Carregar:', id);
  ytPlayer.loadVideoById(id);
  currentVideoId = id;
}

// ===== SERIDOR UI/STATUS (SEM SYNC PLAYER) =====
async function fetchStatus() {
  if (!isValidApi()) return;
  try {
    const res = await fetch(`${API_BASE}/status`, { headers: HEADERS });
    if (!res.ok) return;
    const data = await res.json();
    
    // UI apenas
    trackTitle.textContent = data.track_name || '—';
    trackArtist.textContent = data.artist_name || '—';
    albumArt.src = data.cover || '';
    bgImage.style.backgroundImage = data.cover ? `url(${data.cover})` : '';
    lyricsLine.textContent = data.current_lyric || '';
    
    if (Array.isArray(data.fila)) {
      renderQueue(data.fila.slice(0, 5));
    }
    if (Array.isArray(data.usuarios)) {
      renderListeners(data.usuarios);
    }
    
    updateStatus(true);
  } catch {
    updateStatus(false);
  }
}

function renderQueue(queue) {
  upcomingList.innerHTML = queue.map(i => 
    `<div class="upcoming-item">
      <img src="${i.cover}">
      <div><strong>${i.title}</strong><small>${i.artist}</small></div>
    </div>`
  ).join('') || '<div class="loading">Vazio</div>';
}

function renderListeners(users) {
  listenersPile.innerHTML = users.map(u => 
    `<div class="listener-chip">
      <img src="${u.avatar}">
      <span>${u.name}</span>
    </div>`
  ).join('') || '<div class="loading">Vazio</div>';
}

function updateStatus(ok) {
  const msg = ok ? 'Online' : 'Offline';
  connectionIndicator.style.background = ok ? '#4ade80' : '#ef4444';
  serverStatusText.textContent = msg;
  connectionIcon.textContent = ok ? '🟢' : '🔴';
  connectionMessage.textContent = msg;
}

async function sendCommand(cmd) {
  if (!isValidApi()) return;
  fetch(`${API_BASE}/command`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd })
  });
}

// ===== EVENTOS =====
prevBtn.onclick = () => sendCommand('prev');
nextBtn.onclick = () => sendCommand('next');
playPauseBtn.onclick = () => ytPlayer && ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo();

progress.oninput = () => {
  if (ytPlayer) {
    const duration = ytPlayer.getDuration();
    ytPlayer.seekTo((progress.value / 100) * duration, true);
  }
};

connectBtn.onclick = () => {
  API_BASE = apiLinkInput.value.trim();
  if (!API_BASE.startsWith('http')) return alert('URL inválida');
  localStorage.setItem('jamApiLink', API_BASE);
  updateStatus(false, 'Conectando...');
  fetchStatus();
};

settingsBtn.onclick = () => settingsPanel.classList.toggle('hidden');
cancelProfile.onclick = () => settingsPanel.classList.add('hidden');

// ===== INITS =====
initApiBase();
if (isValidApi()) syncInterval = setInterval(fetchStatus, 2000);

// Tempo: consulta 1x + CSS animação
let videoDuration = 0;

function onVideoLoaded(duration) {
  videoDuration = duration;
  progress.max = 100;
  progress.style.transition = 'value 0s linear';  // Animação nativa
  currentTime.style.transition = 'none';
  durationTime.textContent = formatTime(duration);
  console.log('⏱️ Duration set:', duration);
}

function updateProgress(current, duration) {
  if (videoDuration > 0) {
    const percent = (current / videoDuration) * 100;
    progress.value = percent;
    currentTime.textContent = formatTime(current);
  }
}

// Remover interval - usa eventos YT

