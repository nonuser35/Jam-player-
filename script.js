// dataExample removido conforme requisito de produção (modo exemplo desativado)
// const dataExample = { ... };

const app = document.getElementById('app');
const bgImage = document.getElementById('bgImage');
const albumArt = document.getElementById('albumArt');
const trackArtist = document.getElementById('trackArtist');
const trackTitle = document.getElementById('trackTitle');
const lyricsLine = document.getElementById('lyricsLine');
const upcomingList = document.getElementById('upcomingList');
const userBank = document.getElementById('userBank');
const listenersPile = document.getElementById('listenersPile');
const statusFile = document.getElementById('statusFile');
const serverStatus = document.getElementById('serverStatus');
const connectionIcon = document.getElementById('connectionIcon');
const serverStatusText = document.getElementById('serverStatusText');
const audio = document.getElementById('audio');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const durationTime = document.getElementById('durationTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumePanel = document.getElementById('volumePanel');
const volumeSlider = document.getElementById('volumeSlider');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const profileFile = document.getElementById('profileFile');
const profileName = document.getElementById('profileName');
const profilePreview = document.getElementById('profilePreview');
const saveProfile = document.getElementById('saveProfile');
const cancelProfile = document.getElementById('cancelProfile');

let isPlaying = false;
let currentLyricIndex = 0;
let lyricsInterval;
let volumeTimeout;
let activeTrackIndex = 0;
let currentTrack = null;
let shuffleMode = false;
let repeatMode = false;

// YouTube IFrame API (double-buffering)
let ytPlayer1 = null;
let ytPlayer2 = null;
let activeYTPlayer = null;
let standbyYTPlayer = null;
let activeVideoId = null;
let standbyVideoId = null;
let ytPlayerReady = {
  player1: false,
  player2: false,
};
let transitionSwapped = false;
let isYTUnlocked = false;

// --- CONFIGURAÇÃO DE CONEXÃO ---
let API_BASE = localStorage.getItem('jamApiLink') || 'http://localhost:8000';

// Função para atualizar as rotas sempre que o link mudar
function updateEndpoints(url) {
    API_BASE = url.replace(/\/+$/, '');
    localStorage.setItem('jamApiLink', API_BASE);
    console.log('🔗 Nova API configurada:', API_BASE);
}

// Captura o link ?api= da URL do navegador
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const apiFromUrl = params.get('api');
    if (apiFromUrl) {
        updateEndpoints(decodeURIComponent(apiFromUrl));
        // Limpa a URL para ficar bonita, mas mantém o link salvo
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function getStatusEndpoint() {
    return `${API_BASE}/status`;
}

function getPingEndpoint() {
    return `${API_BASE}/ping`;
}

let isSyncLoading = false;
let latencyMs = 0;
let lastPayload = null;
let lastServerVideoId = null;
let lastServerProgress = 0;
let lastServerTimestamp = 0;
let users = [];
let pendingVideoId = null;
let pendingProgress = 0;
let lastServerIsPlaying = false;
let userSeeked = false;
let syncRetries = 0;
// ✅ Removido retrySyncInterval (não usado, evita TS error)

const apiLinkInput = document.getElementById('apiLinkInput');
const connectBtn = document.getElementById('connectBtn');
const connectionIndicator = document.getElementById('connectionIndicator');
const connectionMessage = document.getElementById('connectionMessage');


function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateProgressDisplay(timeSec, durationSec) {
  const duration = Number(durationSec) || 0;
  const current = Number(timeSec) || 0;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  progress.value = progressPercent;
  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
}

function setPlayButtonState(state) {
  const playIcon = playPauseBtn.querySelector('.play-icon');
  playPauseBtn.classList.remove('loading', 'active');
  if (state === 'loading') {
    isSyncLoading = true;
    playPauseBtn.classList.add('loading');
    playPauseBtn.disabled = true;
    if (playIcon) {
      playIcon.innerHTML = '<circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.0)" />';
    }
  } else if (state === 'playing') {
    isSyncLoading = false;
    playPauseBtn.classList.add('active');
    playPauseBtn.disabled = false;
    if (playIcon) {
      playIcon.innerHTML = '<g><rect x="9" y="7" width="2.5" height="10" fill="rgba(255,255,255,0.95)"/><rect x="13.5" y="7" width="2.5" height="10" fill="rgba(255,255,255,0.95)"/></g>';
    }
  } else {
    isSyncLoading = false;
    playPauseBtn.disabled = false;
    if (playIcon) {
      playIcon.innerHTML = '<polygon points="8 5 19 12 8 19" fill="rgba(255,255,255,0.95)" />';
    }
  }
}

function unlockYTPlayers() {
  if (isYTUnlocked) return;
  if (!ytPlayer1 || !ytPlayer2) return;

  try {
    ytPlayer1.playVideo();
    ytPlayer2.playVideo();
    setTimeout(() => {
      ytPlayer1.pauseVideo();
      ytPlayer2.pauseVideo();
      isYTUnlocked = true;
      console.info('YouTube unlocked');
    }, 250);
  } catch (err) {
    console.warn('unlockYTPlayers failed', err);
    isYTUnlocked = true;
  }
}

function onYouTubeIframeAPIReady() {
  ytPlayer1 = new YT.Player('player1', {
    height: '100%',
    width: '100%',
    videoId: activeVideoId || '',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      iv_load_policy: 3,
    },
    events: {
      onReady: (event) => { ytPlayerReady.player1 = true; initializeYTPlayers(); },
      onStateChange: onYTPlayerStateChange,
      onError: onYTPlayerError,
    }
  });

  ytPlayer2 = new YT.Player('player2', {
    height: '100%',
    width: '100%',
    videoId: activeVideoId || '',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      iv_load_policy: 3,
    },
    events: {
      onReady: (event) => { ytPlayerReady.player2 = true; initializeYTPlayers(); },
      onStateChange: onYTPlayerStateChange,
      onError: onYTPlayerError,
    }
  });
}

function initializeYTPlayers() {
  if (!ytPlayerReady.player1 || !ytPlayerReady.player2) return;
  
  activeYTPlayer = ytPlayer1;
  standbyYTPlayer = ytPlayer2;
  activeYTPlayer.setVolume(100);
  standbyYTPlayer.setVolume(100);
  standbyYTPlayer.mute();
  standbyYTPlayer.pauseVideo();

  console.log('🎥 YT Players inicializados');

  // Handle pending
  if (pendingVideoId) {
    console.log('🚀 Loading pending:', pendingVideoId, 'at', pendingProgress);
    activeVideoId = pendingVideoId;
    activeYTPlayer.loadVideoById({ videoId: pendingVideoId, startSeconds: pendingProgress });
    
    // FORCE SYNC após init
    setTimeout(() => {
      if (activeYTPlayer && pendingProgress > 0) {
        activeYTPlayer.seekTo(pendingProgress, true);
        console.log('✅ Init force seek:', pendingProgress);
      }
    }, 800);
    
    pendingVideoId = null;
    pendingProgress = 0;
  }

  setActiveVisual(activeYTPlayer === ytPlayer1 ? 'player1' : 'player2');
  
  // ✅ Removido: sem retrySync (zero jitters)
}

function setActiveVisual(playerId) {
  document.getElementById('player1').style.opacity = playerId === 'player1' ? '1' : '0.2';
  document.getElementById('player2').style.opacity = playerId === 'player2' ? '1' : '0.2';
}

function onYTPlayerStateChange(event) {
  const state = event.data;
  if (state === YT.PlayerState.ENDED) {
    setPlayButtonState('paused');
    isPlaying = false;
    playNext();
  }
}

function onYTPlayerError(event) {
  const code = event.data;
  if ([100, 101, 150].includes(code)) {
    console.warn('YouTube error', code, '-> pulando para próximo');
    // avisa o servidor (se endpoint suportar) e avança localmente
    fetch(`${getStatusEndpoint()}/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'},
      body: JSON.stringify({command: 'next'})
    }).catch(() => null);
    playNext();
  }
}

function getCooldownPlayer() {
  return activeYTPlayer === ytPlayer1 ? ytPlayer2 : ytPlayer1;
}

function swapToStandbyPlayer() {
  if (!standbyYTPlayer || !activeYTPlayer) return;
  activeYTPlayer.pauseVideo();
  standbyYTPlayer.unMute();
  standbyYTPlayer.playVideo();
  [activeYTPlayer, standbyYTPlayer] = [standbyYTPlayer, activeYTPlayer];
  [activeVideoId, standbyVideoId] = [standbyVideoId, activeVideoId];
  transitionSwapped = true;
  setActiveVisual(activeYTPlayer === ytPlayer1 ? 'player1' : 'player2');
}

function preloadNextVideo(videoId) {
  if (!videoId || !standbyYTPlayer) return;
  if (standbyVideoId === videoId) return;
  standbyVideoId = videoId;
  standbyYTPlayer.mute();
  standbyYTPlayer.cueVideoById(videoId);
  standbyYTPlayer.pauseVideo();
}

function setPlaybackRateForActive(rate) {
  if (!activeYTPlayer || !activeYTPlayer.setPlaybackRate) return;
  activeYTPlayer.setPlaybackRate(rate);
}

async function measureLatency() {
  const start = Date.now();
  try {
    const res = await fetch(getPingEndpoint(), {cache: 'no-store'});
    if (!res.ok) throw new Error('Ping falhou');
    const end = Date.now();
    latencyMs = end - start;
    return latencyMs;
  } catch (err) {
    latencyMs = 0;
    console.warn('Erro ping', err);
    return 0;
  }
}

function normalizeSeconds(value) {
  let number = Number(value) || 0;
  if (number < 0) number = 0;

  // Suporta tanto segundos quanto milissegundos do server (Spotify usa ms, mas o app pode fornecer s)
  // Qualquer valor maior que 1000 provavelmente é ms (música nunca tem >1000s / ~16m de forma comum)
  if (number > 1000) {
    return number / 1000;
  }
  return number;
}

function getServerTimestampMs(payload) {
  return Number(payload.timestamp) || Date.now();
}

function getServerProgressWithLatency(payload) {
  const serverProgress = normalizeSeconds(payload.progress);
  const sentTimestamp = getServerTimestampMs(payload);
  const serverNow = sentTimestamp + latencyMs / 2;
  const progressNow = serverProgress + (serverNow - sentTimestamp) / 1000;
  return progressNow;
}

function setConnectionStatus(connected, msg) {
  if (!connectionIndicator || !connectionMessage) return;
  if (connected) {
    connectionIndicator.classList.add('connected');
    connectionIndicator.classList.remove('disconnected');
    connectionMessage.textContent = msg || 'Conectado';
  } else {
    connectionIndicator.classList.add('disconnected');
    connectionIndicator.classList.remove('connected');
    connectionMessage.textContent = msg || 'Desconectado';
  }
}

function updateApiEndpoint(url) {
  updateEndpoints(url);
}

function tryAutoConfigureFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const apiFromUrl = params.get('api');
  if (!apiFromUrl) return false;
  const decodedApi = decodeURIComponent(apiFromUrl);
  updateApiEndpoint(decodedApi);
  if (apiLinkInput) apiLinkInput.value = API_BASE;
  setConnectionStatus(false, 'Conectando...');
  if (connectionIcon) connectionIcon.textContent = '🟡';
  fetchServerStatus().then(() => {
    setConnectionStatus(true, 'Conectado (via URL)');
    if (!isSyncLoading) startServerSync();
  }).catch(() => {
    setConnectionStatus(false, 'Falha ao conectar via URL');
    if (!isSyncLoading) startServerSync();
  });
  return true;
}

async function validateApiLink(url) {
  try {
    const resp = await fetch(`${url.replace(/\/+$/, '')}/ping`, {cache:'no-store'});
    return resp.ok;
  } catch (error) {
    return false;
  }
}

async function postProfile(name, avatar) {
  try {
    const resp = await fetch(getStatusEndpoint(), {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'},
      body: JSON.stringify({nome: name, foto: avatar})
    });
    if (!resp.ok) throw new Error('Falha no POST perfil');
    const payload = await resp.json();
    if (Array.isArray(payload.usuarios)) renderListeners(payload.usuarios);
    if (Array.isArray(payload.fila)) renderQueue(payload.fila);
    return payload;
  } catch (e) {
    console.warn('Erro postProfile', e);
    return null;
  }
}

function getDominantColor(imgUrl, callback) {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = imgUrl;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 1, 1);
    const [r,g,b] = ctx.getImageData(0,0,1,1).data;
    callback(r, g, b);
  };
  img.onerror = () => {
    callback(99, 160, 255);
  };
}

async function fetchServerStatus() {
    try {
        const STATUS_ENDPOINT = `${API_BASE}/status`;
        const resp = await fetch(STATUS_ENDPOINT + '?_=' + Date.now(), {
            cache: 'no-store',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        if (!resp.ok) {
            console.warn('fetchServerStatus: status HTTP', resp.status, resp.statusText);
            throw new Error('Servidor Offline');
        }
        const payload = await resp.json();
// console.debug('fetchServerStatus payload:', payload);
        updateFromServerPayload(payload);
        setConnectionStatus(true, 'Online');
    } catch (error) {
        console.warn('Erro de sincronização:', error);
        setConnectionStatus(false, 'Reconectando...');
    }
}

function startServerSync() {
  fetchServerStatus();
  setInterval(fetchServerStatus, 1000);
}

function renderUpcoming(queue) {
  renderQueue(queue);
}

function updateFromServerPayload(data) {
  if (!data || typeof data !== 'object') return;

// console.debug('Payload:', { video_id: data.video_id, progress: data.progress, is_playing: data.is_playing });

  lastPayload = data;

  // UI básica
  trackTitle.textContent = data.track_name || 'Sem música';
  trackArtist.textContent = data.artist_name || 'Artista desconhecido';
  if (data.cover) {
    albumArt.src = data.cover;
    bgImage.style.backgroundImage = `url('${data.cover}')`;
  }
  lyricsLine.textContent = data.current_lyric || 'Aguardando letra...';

  const serverVideoId = data.video_id ? String(data.video_id).trim() : null;
  const duration = normalizeSeconds(data.duration);
  const normalizedProgress = duration > 0 ? Math.min(getServerProgressWithLatency(data), duration + 1) : 0;
  const serverPlaying = !!data.is_playing;

  // ===== SYNC #1: NOVO VÍDEO =====
  if (serverVideoId && serverVideoId !== activeVideoId && activeYTPlayer) {
    console.log(`🔄 Sync #1 (novo vídeo): ${serverVideoId} → ${normalizedProgress.toFixed(1)}s`);
    activeVideoId = serverVideoId;
    activeYTPlayer.loadVideoById({ videoId: serverVideoId, startSeconds: normalizedProgress });
    setTimeout(() => activeYTPlayer.seekTo(normalizedProgress, true), 300);  // Após load
    pendingVideoId = null;
    return;
  }

  if (!activeVideoId || !activeYTPlayer || serverVideoId !== activeVideoId) return;

  const currentTime = activeYTPlayer.getCurrentTime() || 0;
  const timeDiff = Math.abs(currentTime - normalizedProgress);

  // ===== SYNC #2: USER SEEK >8s =====
  if (userSeeked && timeDiff > 8) {
    console.log(`🔄 Sync #2 (user seek>8s): ${currentTime.toFixed(1)}s → ${normalizedProgress.toFixed(1)}s`);
    activeYTPlayer.seekTo(normalizedProgress, true);
    userSeeked = false;
    return;
  }

  // ===== SYNC #3: Despause SÓ se YT PAUSED =====
  if (serverPlaying && !lastServerIsPlaying && activeYTPlayer.getPlayerState() !== 1) {
    console.log(`🔄 Sync #3 (despause): ${normalizedProgress.toFixed(1)}s`);
    activeYTPlayer.seekTo(normalizedProgress, true);
    lastServerIsPlaying = true;
    return;
  }

  // ===== SYNC #4: ÚLTIMOS 4s =====
  if (normalizedProgress > duration - 4) {
    console.log(`🔄 Sync #4 (4s final): ${normalizedProgress.toFixed(1)}s`);
    activeYTPlayer.seekTo(normalizedProgress, true);
    return;
  }

  // SEM SYNC: player livre
  if (timeDiff > 1) console.log(`⏸️ No sync (diff ${timeDiff.toFixed(1)}s): player livre`);

  // Play/pause DESABILITADO (evita conflitos server)
  /*
  const ytState = activeYTPlayer.getPlayerState();
  if (serverPlaying && ytState !== YT.PlayerState.PLAYING) {
    unlockYTPlayers();
    activeYTPlayer.playVideo();
    setPlayButtonState('playing');
    isPlaying = true;
  } else if (!serverPlaying && ytState === YT.PlayerState.PLAYING) {
    activeYTPlayer.pauseVideo();
    setPlayButtonState('paused');
    isPlaying = false;
  }
  */

  // Fila/Listeners
  const queue = Array.isArray(data.fila) ? data.fila : [];
  renderUpcoming(queue);
  if (Array.isArray(data.usuarios)) renderListeners(data.usuarios);

  lastServerProgress = normalizedProgress;
  if (!serverPlaying) lastServerIsPlaying = false;  // ✅ Reset para próximo despause
  else lastServerIsPlaying = serverPlaying;
}

function updateTrackInfo(track) {
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  albumArt.src = track.cover;
  bgImage.style.backgroundImage = `url('${track.cover}')`;
  if (track.audio && track.audio !== audio.src) {
    audio.src = track.audio;
  }

  if (track.videoId && activeYTPlayer) {
    activeVideoId = track.videoId;
    activeYTPlayer.cueVideoById({ videoId: activeVideoId, startSeconds: 0 });
    setPlayButtonState('paused');
  }

  currentTrack = track;
  currentLyricIndex = 0;
  showLyric(0);
  getDominantColor(track.cover, (r, g, b) => {
    document.documentElement.style.setProperty('--ring-rgb', `${r},${g},${b}`);
  });
}


function showLyric(index) {
  lyricsLine.classList.remove('visible');
  setTimeout(() => {
    const line = currentTrack.lyrics[index] || '';
    lyricsLine.textContent = line ? `"${line}"` : '';
    lyricsLine.classList.add('visible');
  }, 220);
}

function startLyricsRotation() {
  if (lyricsInterval) clearInterval(lyricsInterval);
  showLyric(currentLyricIndex);
  lyricsInterval = setInterval(() => {
    currentLyricIndex = (currentLyricIndex + 1) % currentTrack.lyrics.length;
    showLyric(currentLyricIndex);
  }, 5000);
}

function renderQueue(items) {
  const sourceList = Array.isArray(items) ? items : [];
  const limitedList = sourceList.slice(0, 5); // limitar a 5 itens
  upcomingList.innerHTML = '';
  if (!limitedList.length) {
    const empty = document.createElement('div');
    empty.className = 'upcoming-item';
    empty.textContent = 'Nenhuma próxima música disponível';
    upcomingList.appendChild(empty);
    return;
  }
  limitedList.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'upcoming-item';
    el.innerHTML = `<img src="${item.cover || ''}" alt="cover"><div><strong>${item.title || 'Desconhecido'}</strong><br><small>${item.artist || 'Artista'}</small></div>`;
    upcomingList.appendChild(el);
    requestAnimationFrame(() => el.classList.add('fade-in')); // garantir animação
  });
}

function renderListeners(users) {
  const source = Array.isArray(users) ? users : [];
  listenersPile.innerHTML = '';
  if (!source.length) {
    listenersPile.innerHTML = '<div class="loading">Nenhum ouvinte conectado</div>';
    return;
  }
  source.forEach((u) => {
    const chip = document.createElement('div');
    chip.className = 'listener-chip';
    chip.innerHTML = `<img src="${u.avatar || 'https://via.placeholder.com/20?text=U'}" alt="${u.name || 'Ouvinte'}" /><span>${u.name || 'Ouvinte'}</span>`;
    listenersPile.appendChild(chip);
  });
}

function renderUsers(users) {
  userBank.innerHTML = '';
  const source = Array.isArray(users) ? users : [];
  source.forEach((user) => {
    const el = document.createElement('div');
    el.className = 'user-item';
    el.setAttribute('data-name', user.name);
    el.innerHTML = `<img src="${user.avatar || 'https://via.placeholder.com/40'}" alt="${user.name || 'Ouvinte'}">`;
    el.addEventListener('mouseenter', () => { el.style.filter = 'blur(0.3px)'; });
    el.addEventListener('mouseleave', () => { el.style.filter = 'none'; });
    userBank.appendChild(el);
  });
}

async function togglePlay() {
  if (!activeYTPlayer) return;
  
  const playerState = activeYTPlayer.getPlayerState();
  
  // PAUSE: Imediato + servidor  
  if (playerState === YT.PlayerState.PLAYING) {
    activeYTPlayer.pauseVideo();
    sendServerCommand('pause');
    setPlayButtonState('paused');
    isPlaying = false;
    return;
  }
  
  // PLAY: Loading spinner durante despause sync
  setPlayButtonState('loading');
  unlockYTPlayers();
  activeYTPlayer.playVideo();
  isPlaying = true;
  
  // Remove loading após 2s ou play state (timeout safety)
  const timeoutId = setTimeout(() => {
    setPlayButtonState('playing');
  }, 2000);
  
  // Listener temporário para confirmar play
  const checkPlay = () => {
    if (activeYTPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
      setPlayButtonState('playing');
      clearTimeout(timeoutId);
      document.removeEventListener('playerStateChange', checkPlay);
    }
  };
}

function sendServerCommand(command) {
  fetch(`${getStatusEndpoint()}/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ command }),
  }).catch((err) => console.warn('Falha ao enviar comando', command, err));
}

function setTrack(idx) {
  console.warn('setTrack não implementado no modo de servidor. Use o servidor para alterar faixa.');
}

function playNext() {
  sendServerCommand('next');
}

function playPrev() {
  sendServerCommand('prev');
}

function refreshProgressDisplay() {
  if (!activeYTPlayer) return;
  
  // ✅ SEMPRE player time = animação suave (zero lag)
  const duration = activeYTPlayer.getDuration() || 0;
  const current = activeYTPlayer.getCurrentTime ? activeYTPlayer.getCurrentTime() : 0;
  updateProgressDisplay(current, duration);
}

setInterval(refreshProgressDisplay, 400);

progress.addEventListener('input', () => {
  if (!activeYTPlayer || !activeYTPlayer.getDuration) return;
  const duration = activeYTPlayer.getDuration();
  if (!duration) return;
  const target = (progress.value / 100) * duration;
  userSeeked = true;
  try {
    activeYTPlayer.seekTo(target, true);
  } catch (e) {
    console.warn('user seekTo falhou', e);
  }
  console.debug('usuario pulo para', target);
});

playPauseBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);
shuffleBtn.addEventListener('click', () => {
  shuffleMode = !shuffleMode;
  shuffleBtn.classList.toggle('active', shuffleMode);
  if (shuffleMode) repeatMode = false;
  repeatBtn.classList.toggle('active', repeatMode);
});
repeatBtn.addEventListener('click', () => {
  repeatMode = !repeatMode;
  repeatBtn.classList.toggle('active', repeatMode);
  if (repeatMode) shuffleMode = false;
  shuffleBtn.classList.toggle('active', shuffleMode);
});
audio.addEventListener('ended', () => {
  if (repeatMode) {
    audio.currentTime = 0;
    audio.play();
  } else {
    playNext();
  }
});

// ✅ Sem retrySync (zero jitters, código limpo)

// Tab control inside settings panel
const sectionButtons = document.querySelectorAll('.section-btn');
const sectionPanels = document.querySelectorAll('.section-panel');
sectionButtons.forEach(button => {
  button.addEventListener('click', () => {
    sectionButtons.forEach(b => b.classList.remove('active'));
    sectionPanels.forEach(panel => panel.classList.remove('active'));
    button.classList.add('active');
    const target = button.getAttribute('data-section');
    document.querySelector(`.section-panel[data-section="${target}"]`).classList.add('active');
  });
});

volumeBtn.addEventListener('click', () => {
  volumePanel.style.display = volumePanel.style.display === 'block' ? 'none' : 'block';
  if (volumePanel.style.display === 'block') {
    clearTimeout(volumeTimeout);
    volumeTimeout = setTimeout(() => { volumePanel.style.display = 'none'; }, 3000);
  }
});

volumeSlider.addEventListener('input', () => {
  const value = Number(volumeSlider.value);
  if (!Number.isNaN(value)) {
    audio.volume = value;
    if (activeYTPlayer && typeof activeYTPlayer.setVolume === 'function') {
      activeYTPlayer.setVolume(Math.round(value * 100));
    }
    if (standbyYTPlayer && typeof standbyYTPlayer.setVolume === 'function') {
      standbyYTPlayer.setVolume(Math.round(value * 100));
    }
  }
});

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

cancelProfile.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

saveProfile.addEventListener('click', async () => {
  const name = profileName.value.trim();
  const photo = profilePreview.src;
  if (!name || !photo) return alert('Informe nome e foto.');

  users[0] = { name, avatar: photo };
  renderUsers(users);
  statusFile.textContent = `Arquivo de listeners: perfil ${name} atualizado`;
  settingsPanel.classList.add('hidden');

  const payload = await postProfile(name, photo);
  if (payload) {
    renderListeners(payload.usuarios || []);
    renderQueue(payload.fila || []);
    if (Array.isArray(payload.usuarios)) {
      users = payload.usuarios;
    }
  }
});

if (connectBtn) {
  connectBtn.addEventListener('click', async () => {
    const url = apiLinkInput.value.trim();
    if (!url) return alert('Insira o link da API (ngrok)');

    const valid = await validateApiLink(url);
    if (valid) {
      updateApiEndpoint(url);
      setConnectionStatus(true, 'Conectado');
      fetchServerStatus();
      if (!isSyncLoading) startServerSync();
    } else {
      setConnectionStatus(false, 'Inacessível');
      alert('Não foi possível conectar no URL informado.');
    }
  });
}

profileFile.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    profilePreview.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

function init() {
  checkUrlParams();
  serverStatusText.textContent = 'JAM Spotify ON';
  connectionIcon.textContent = '🟡';
  apiLinkInput.value = API_BASE;
  setConnectionStatus(false, 'Aguardando servidor...');
  startServerSync();
}

init();
