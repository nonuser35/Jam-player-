// JAM Spotify Player - Sync SIMPLES do zero
// Site abre → carrega video+progress server → toca → sync 1s se diff>2s

const app = document.getElementById('app');
const albumArt = document.getElementById('albumArt');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const lyricsLine = document.getElementById('lyricsLine');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const durationTime = document.getElementById('durationTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiLinkInput = document.getElementById('apiLinkInput');
const connectBtn = document.getElementById('connectBtn');

let API_BASE = localStorage.getItem('jamApiLink') || 'http://localhost:8000';
let activeYTPlayer = null;
let lastPayload = null;
let isPlaying = false;
let userSeeked = false;

// ========== YT PLAYER ==========
let ytPlayer = null;
function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('player1', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, rel: 0 },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });
}

function onPlayerReady(event) {
  console.log('🎥 YT pronto - sync iniciando');
  syncFromServer();
}

function onPlayerStateChange(event) {
  if (event.data == YT.PlayerState.ENDED) playNext();
}

function onPlayerError(event) {
  console.log('YouTube erro', event.data);
  playNext();
}

// ========== SYNC SERVER ==========
function getStatusEndpoint() { return `${API_BASE}/status`; }

async function syncFromServer() {
  try {
    const res = await fetch(getStatusEndpoint());
    const data = await res.json();
    console.log('📡 Server:', data.video_id, data.progress);
    
    lastPayload = data;
    
    // UI
    trackTitle.textContent = data.track_name || '';
    trackArtist.textContent = data.artist_name || '';
    albumArt.src = data.cover || '';
    
    const progress = Number(data.progress) / 1000;  // ms→s
    const duration = Number(data.duration) / 1000;
    
    // SYNC 1: NOVO VÍDEO
    if (data.video_id && data.video_id != activeVideoId) {
      console.log('🔄 Sync NOVO:', data.video_id, progress.toFixed(1)+'s');
      activeVideoId = data.video_id;
      ytPlayer.loadVideoById({videoId: data.video_id, startSeconds: progress});
      if (data.is_playing) ytPlayer.playVideo();
      return;
    }
    
    // SYNC 2: DIFF >2s
    const current = ytPlayer.getCurrentTime();
    const diff = Math.abs(current - progress);
    if (diff > 2) {
      console.log('🔄 Sync DIFF', diff.toFixed(1)+'s →', progress.toFixed(1));
      ytPlayer.seekTo(progress, true);
    }
    
    // SYNC 3: PLAY/PAUSE
    const playing = ytPlayer.getPlayerState() == 1;
    if (data.is_playing && !playing) ytPlayer.playVideo();
    if (!data.is_playing && playing) ytPlayer.pauseVideo();
    
    updateProgress(current, duration);
    
  } catch (e) {
    console.error('Sync erro:', e);
  }
}

// ========== BARRA PROGRESSO ==========
function updateProgress(current, duration) {
  const percent = duration ? (current / duration) * 100 : 0;
  progress.value = percent;
  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
}

setInterval(() => {
  if (ytPlayer) {
    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration();
    updateProgress(current, duration);
  }
}, 250);

// User seek
progress.addEventListener('input', () => {
  userSeeked = true;
  const duration = ytPlayer.getDuration();
  ytPlayer.seekTo((progress.value / 100) * duration);
});

// ========== CONTROLES ==========
playPauseBtn.addEventListener('click', () => {
  if (ytPlayer.getPlayerState() == 1) {
    ytPlayer.pauseVideo();
    sendCommand('pause');
  } else {
    ytPlayer.playVideo();
    sendCommand('play');
  }
});

nextBtn.addEventListener('click', () => sendCommand('next'));
prevBtn.addEventListener('click', () => sendCommand('prev'));

function sendCommand(cmd) {
  fetch(`${getStatusEndpoint()}/command`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({command: cmd})
  });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ========== SETTINGS ==========
connectBtn.addEventListener('click', async () => {
  API_BASE = apiLinkInput.value;
  localStorage.setItem('jamApiLink', API_BASE);
  console.log('🌐 API:', API_BASE);
  syncFromServer();
});

// Init
function init() {
  syncFromServer();
  setInterval(syncFromServer, 1000);
}
init();

