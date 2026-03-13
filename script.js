// JAM Player - SYNC ÚNICO INICIAL
// Abre → 1x sync tempo Spotify → toca → livre (barra anima)

const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const albumArt = document.getElementById('albumArt');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const durationTime = document.getElementById('durationTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const apiLinkInput = document.getElementById('apiLinkInput');
const connectBtn = document.getElementById('connectBtn');

let API_BASE = localStorage.getItem('jamApiLink') || '';
let ytPlayer = null;
let synced = false;  // ÚNICO sync

function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('player1', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 0, controls: 0 },
    events: { 'onReady': onPlayerReady }
  });
}

function onPlayerReady() {
  console.log('Player pronto - sync único');
  syncOnce();
}

async function syncOnce() {
  if (synced) return;
  
  try {
    const res = await fetch(`${API_BASE}/status`);
    const data = await res.json();
    console.log('🔄 Sync único:', data.video_id, data.progress/1000 + 's');
    
    // UI
    trackTitle.textContent = data.track_name;
    trackArtist.textContent = data.artist_name;
    albumArt.src = data.cover;
    
    // SYNC ÚNICO
    const progress = Number(data.progress) / 1000;
    ytPlayer.loadVideoById({
      videoId: data.video_id,
      startSeconds: progress  // Tempo exato Spotify
    });
    
    if (data.is_playing) ytPlayer.playVideo();
    
    synced = true;
    console.log('✅ Sync único feito - player livre');
    
  } catch (e) {
    console.error('Sync erro:', e);
    setTimeout(syncOnce, 2000);  // Retry 1x
  }
}

// Barra ANIMA LIVRE (sempre)
setInterval(() => {
  if (ytPlayer) {
    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration();
    const percent = duration ? (current / duration) * 100 : 0;
    progress.value = percent;
    currentTime.textContent = formatTime(current);
    durationTime.textContent = formatTime(duration);
  }
}, 250);

// User seek OK
progress.addEventListener('input', () => {
  const duration = ytPlayer.getDuration();
  ytPlayer.seekTo((progress.value / 100) * duration);
});

// Play/pause NORMAL
playPauseBtn.addEventListener('click', () => {
  if (ytPlayer.getPlayerState() == 1) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
});

function formatTime(s) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

// Settings
connectBtn.onclick = () => {
  API_BASE = apiLinkInput.value;
  localStorage.setItem('jamApiLink', API_BASE);
  synced = false;
  syncOnce();
};

// Init
syncOnce();

