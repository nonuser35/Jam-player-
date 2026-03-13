/* JAM Player - Sync Spotify → YouTube
* Python Flask /status → sync tempo exato + barra livre
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
const audio = document.getElementById('audio');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const durationTime = document.getElementById('durationTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeSlider = document.getElementById('volumeSlider');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiLinkInput = document.getElementById('apiLinkInput');
const connectBtn = document.getElementById('connectBtn');
const connectionIndicator = document.getElementById('connectionIndicator');
const connectionMessage = document.getElementById('connectionMessage');
const profileFile = document.getElementById('profileFile');
const profileName = document.getElementById('profileName');
const profilePreview = document.getElementById('profilePreview');
const saveProfile = document.getElementById('saveProfile');
const cancelProfile = document.getElementById('cancelProfile');

// ===== API_BASE DINÂMICA =====
let API_BASE = '';  // ✅ VAZIO

// Inicialização: URL params > localStorage > vazio
function initApiBase() {
  const params = new URLSearchParams(window.location.search);
  const apiFromUrl = params.get('api');
  
  if (apiFromUrl) {
    API_BASE = decodeURIComponent(apiFromUrl);
    localStorage.setItem('jamApiLink', API_BASE);
    console.log('🌐 API via URL:', API_BASE);
    // Limpa URL limpa
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    API_BASE = localStorage.getItem('jamApiLink') || '';
    console.log('🌐 API localStorage:', API_BASE || 'vazio');
  }
  
  apiLinkInput.value = API_BASE;
}

function getStatusEndpoint() {
  return `${API_BASE}/status`;
}

function safeFetch(url) {
  if (!API_BASE || !API_BASE.startsWith('http')) {
    console.warn('🚫 API_BASE inválida, pulando fetch');
    return Promise.reject('API vazia');
  }
  return fetch(url, {
    headers: { 'ngrok-skip-browser-warning': 'true' }
  });
}

// YouTube
let ytPlayer1 = null;
let ytPlayer2 = null;
let activeYTPlayer = null;
let standbyYTPlayer = null;
let activeVideoId = null;
let ytPlayerReady = { player1: false, player2: false };
let isYTUnlocked = false;
let pendingVideoId = null;
let pendingProgress = 0;
let userSeeked = false;
let lastServerIsPlaying = false;

function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function updateProgressDisplay(timeSec, durationSec) {
  const duration = Number(durationSec) || 0;
  const current = Number(timeSec) || 0;
  progress.value = duration ? (current / duration) * 100 : 0;
  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
}

function setPlayButtonState(state) {
  playPauseBtn.classList.remove('loading', 'active');
  const icon = playPauseBtn.querySelector('.play-icon');
  if (state === 'loading') {
    playPauseBtn.classList.add('loading');
    icon.innerHTML = '<circle cx="12" cy="12" r="3" fill="currentColor" />';
  } else if (state === 'playing') {
    playPauseBtn.classList.add('active');
    icon.innerHTML = '<rect x="6" y="4" width="2" height="16"/><rect x="11" y="4" width="2" height="16"/>';
  } else {
    icon.innerHTML = '<polygon points="5,5 16,12 5,19" />';
  }
}

function unlockYTPlayers() {
  if (isYTUnlocked) return;
  try {
    ytPlayer1.playVideo();
    ytPlayer2.playVideo();
    setTimeout(() => {
      ytPlayer1.pauseVideo();
      ytPlayer2.pauseVideo();
      isYTUnlocked = true;
    }, 200);
  } catch (e) {}
}

function onYouTubeIframeAPIReady() {
  ytPlayer1 = new YT.Player('player1', {
    height: '100%', width: '100%',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1 },
    events: { onReady: () => { ytPlayerReady.player1 = true; initPlayers(); }, onStateChange: onPlayerStateChange }
  });
  ytPlayer2 = new YT.Player('player2', {
    height: '100%', width: '100%',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1 },
    events: { onReady: () => { ytPlayerReady.player2 = true; initPlayers(); }, onStateChange: onPlayerStateChange }
  });
}

function initPlayers() {
  if (!ytPlayerReady.player1 || !ytPlayerReady.player2) return;
  console.log('🎥 Players prontos');
  activeYTPlayer = ytPlayer1;
  standbyYTPlayer = ytPlayer2;
  activeYTPlayer.setVolume(100);
  if (pendingVideoId) loadPending();
  setActiveVisual('player1');
}

function loadPending() {
  console.log('📦 Loading pending:', pendingVideoId, pendingProgress);
  activeVideoId = pendingVideoId;
  activeYTPlayer.loadVideoById({ videoId: pendingVideoId, startSeconds: pendingProgress });
  setTimeout(() => activeYTPlayer.seekTo(pendingProgress, true), 500);
  pendingVideoId = pendingProgress = 0;
}

function setActiveVisual(id) {
  document.getElementById('player1').style.opacity = id === 'player1' ? '1' : '0';
  document.getElementById('player2').style.opacity = id === 'player2' ? '1' : '0';
}

function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.ENDED) playNext();
}

async function fetchStatus() {
  try {
    const res = await safeFetch(getStatusEndpoint());
    if (!res.ok) return;
    const data = await res.json();
    updatePayload(data);
  } catch (e) {
    console.warn('Fetch falhou:', e);
  }
}

function updatePayload(data) {
  // UI
  trackTitle.textContent = data.track_name || '—';
  trackArtist.textContent = data.artist_name || '—';
  albumArt.src = data.cover;
  bgImage.style.backgroundImage = `url(${data.cover})`;
  lyricsLine.textContent = data.current_lyric || '';

  const videoId = String(data.video_id || '').trim();
  const progress = Number(data.progress) / 1000 || 0;
  const duration = Number(data.duration) / 1000 || 0;
  const isPlaying = !!data.is_playing;

  // Sync
  if (videoId && (videoId !== activeVideoId || !activeYTPlayer)) {
    pendingVideoId = videoId;
    pendingProgress = progress;
    if (activeYTPlayer) loadPending();
  }

  // Play/pause
  if (activeYTPlayer) {
    const state = activeYTPlayer.getPlayerState();
    if (isPlaying && state !== 1) {
      unlockYTPlayers();
      activeYTPlayer.playVideo();
    } else if (!isPlaying && state === 1) {
      activeYTPlayer.pauseVideo();
    }
  }

  // Fila
  if (Array.isArray(data.fila)) {
    renderQueue(data.fila.slice(0, 5));
  }

  updateProgressDisplay(progress, duration);
  setConnectionStatus(true, 'Sync OK');
}

function renderQueue(queue) {
  upcomingList.innerHTML = queue.map(item => 
    `<div class="upcoming-item">
      <img src="${item.cover}" alt="">
      <div><strong>${item.title}</strong><small>${item.artist}</small></div>
    </div>`
  ).join('') || '<div class="loading">Vazio</div>';
}

function setConnectionStatus(ok, msg) {
  connectionIndicator.style.background = ok ? '#3fff7b' : '#f55';
  connectionMessage.textContent = msg || (ok ? 'Conectado' : 'Offline');
  serverStatusText.textContent = msg || (ok ? 'Online' : 'Offline');  // ✅ Status central
  connectionIcon.textContent = ok ? '🟢' : '🔴';
}

function playNext() { safeFetch(`${getStatusEndpoint()}/command`, { method: 'POST', body: JSON.stringify({command: 'next'}), headers: {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'} }).catch(() => {}); }

function onProgressChange() {
  if (!activeYTPlayer) return;
  const duration = activeYTPlayer.getDuration();
  activeYTPlayer.seekTo((progress.value / 100) * duration, true);
  userSeeked = true;
}

progress.oninput = onProgressChange;

playPauseBtn.onclick = () => {
  if (!activeYTPlayer) return;
  const state = activeYTPlayer.getPlayerState();
  if (state === 1) activeYTPlayer.pauseVideo();
  else {
    unlockYTPlayers();
    activeYTPlayer.playVideo();
  }
};

prevBtn.onclick = () => safeFetch(`${getStatusEndpoint()}/command`, { method: 'POST', body: JSON.stringify({command: 'prev'}), headers: {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'} }).catch(() => {});
nextBtn.onclick = playNext;

connectBtn.onclick = () => {
  const url = apiLinkInput.value.trim();
  if (!url.startsWith('http')) return alert('URL inválida');
  API_BASE = url;
  localStorage.setItem('jamApiLink', API_BASE);
  setConnectionStatus(false, 'Conectando...');
  fetchStatus();
};

volumeSlider.oninput = (e) => {
  const vol = e.target.value * 100;
  if (activeYTPlayer) activeYTPlayer.setVolume(vol);
  if (standbyYTPlayer) standbyYTPlayer.setVolume(vol);
};

settingsBtn.onclick = () => settingsPanel.classList.toggle('hidden');
cancelProfile.onclick = () => settingsPanel.classList.add('hidden');

initApiBase();
setInterval(fetchStatus, 1500);

setInterval(() => {
  if (activeYTPlayer) {
    const current = activeYTPlayer.getCurrentTime() || 0;
    const duration = activeYTPlayer.getDuration() || 0;
    if (duration > 0) updateProgressDisplay(current, duration);
  }
}, 250);
