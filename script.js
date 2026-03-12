const dataExample = {
  currentTrack: {
    title: 'Reflexo Noturno',
    artist: 'Nuvem Azul',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    videoId: 'M7lc1UVf-VE',
    audio: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_4212a34e8d.mp3?filename=acoustic-guitar-12304.mp3',
    lyrics: [
      'No silêncio da noite, o vento me guia',
      'Entre estrelas e lembranças, nossa melodia',
      'No passo suave, dança a lua inteira',
      'É o ritmo do presente, em cada nova beira',
    ],
  },
  queue: [
    { title: 'Alvorada Lunar', artist: 'Eco Solar', cover: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80', videoId: 'H1r4J0u0vzs' },
    { title: 'Céu em Chamas', artist: 'Maré Brava', cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=640&q=80', videoId: 'fK5gI2U-n1k' },
    { title: 'Som do Mar', artist: 'Rio Sereno', cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=80', videoId: 'VbfpW0pbvaU' },
    { title: 'Luz do Amanhecer', artist: 'Fase Lunar', cover: 'https://images.unsplash.com/photo-1481349518771-20055b2a7b24?auto=format&fit=crop&w=640&q=80', videoId: 'kXYiU_JCYtU' },
    { title: 'Vento e Areia', artist: 'Praia Fina', cover: 'https://images.unsplash.com/photo-1445820135145-95eac7c17d61?auto=format&fit=crop&w=640&q=80' },
  ],
  users: [
    { name: 'Luana', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
    { name: 'Miguel', avatar: 'https://randomuser.me/api/portraits/men/46.jpg' },
    { name: 'Sofia', avatar: 'https://randomuser.me/api/portraits/women/47.jpg' },
    { name: 'Pedro', avatar: 'https://randomuser.me/api/portraits/men/48.jpg' },
  ],
};

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
let currentTrack = dataExample.currentTrack;
let shuffleMode = false;
let repeatMode = false;

// YouTube IFrame API (double-buffering)
let ytPlayer1 = null;
let ytPlayer2 = null;
let activeYTPlayer = null;
let standbyYTPlayer = null;
let activeVideoId = dataExample.currentTrack.videoId || null;
let standbyVideoId = null;
let ytPlayerReady = {
  player1: false,
  player2: false,
};
let transitionSwapped = false;
let isYTUnlocked = false;

let API_BASE = localStorage.getItem('jamApiLink') || 'http://localhost:3000';
let STATUS_ENDPOINT = `${API_BASE}/status`;
let PING_ENDPOINT = `${API_BASE}/ping`;
let isSyncLoading = false;
let latencyMs = 0;
let lastPayload = null;

const apiLinkInput = document.getElementById('apiLinkInput');
const connectBtn = document.getElementById('connectBtn');
const connectionIndicator = document.getElementById('connectionIndicator');
const connectionMessage = document.getElementById('connectionMessage');


function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
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
    videoId: activeVideoId || 'dQw4w9WgXcQ',
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
    videoId: activeVideoId || 'dQw4w9WgXcQ',
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
  if (activeVideoId) {
    activeYTPlayer.cueVideoById(activeVideoId);
  }
  if (standbyVideoId) {
    standbyYTPlayer.cueVideoById(standbyVideoId);
  }
  setActiveVisual('player1');
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
    fetch(`${STATUS_ENDPOINT}/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
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
    const res = await fetch(PING_ENDPOINT, {cache: 'no-store'});
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

function getServerTimestampMs(payload) {
  return (payload.timestamp || Date.now());
}

function getServerProgressWithLatency(payload) {
  const serverNow = getServerTimestampMs(payload) + latencyMs / 2;
  const progressNow = (payload.progress || 0) + (serverNow - getServerTimestampMs(payload)) / 1000;
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
  if (!url) return;
  API_BASE = url.replace(/\/+$/, '');
  localStorage.setItem('jamApiLink', API_BASE);
  STATUS_ENDPOINT = `${API_BASE}/status`;
  PING_ENDPOINT = `${API_BASE}/ping`;
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
    const resp = await fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
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
    const resp = await fetch(STATUS_ENDPOINT + '?_=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) throw new Error('Status não disponível');
    const payload = await resp.json();
    await updateFromServerPayload(payload);
  } catch (error) {
    console.warn('status fetch', error);
    serverStatusText.textContent = 'Erro server: ' + (error.message || 'offline');
    connectionIcon.textContent = '🔴';
  }
}

function startServerSync() {
  fetchServerStatus();
  setInterval(fetchServerStatus, 1000);
}

async function updateFromServerPayload(payload) {
  lastPayload = payload;
  serverStatusText.textContent = `Servidor: ${payload.track_name || 'desconhecido'} - ${payload.artist_name || 'desconhecido'}`;
  statusFile.textContent = `Listeners: ${payload.listeners || 0} | Latency: ${latencyMs} ms`;

  if (Array.isArray(payload.usuarios)) renderListeners(payload.usuarios);
  if (Array.isArray(payload.fila)) renderQueue(payload.fila);

  if (payload.track_name && payload.artist_name) {
    updateTrackInfo({
      title: payload.track_name,
      artist: payload.artist_name,
      cover: payload.cover || currentTrack.cover,
      audio: payload.audio || currentTrack.audio,
      lyrics: currentTrack.lyrics
    });
  }

  if (payload.command === 'pause') {
    if (activeYTPlayer) activeYTPlayer.pauseVideo();
    setPlayButtonState('paused');
    isPlaying = false;
    return;
  }

  if (payload.command === 'play' || payload.command === 'resume') {
    setPlayButtonState('loading');
    await measureLatency();
    const desiredProgress = (payload.progress || 0) + latencyMs / 2000;

    if (typeof payload.video_id === 'string' && payload.video_id !== currentTrack.videoId) {
      currentTrack.videoId = payload.video_id;
      activeVideoId = payload.video_id;
      if (activeYTPlayer && ytPlayerReady.player1 && ytPlayerReady.player2) {
        activeYTPlayer.loadVideoById({ videoId: activeVideoId, startSeconds: desiredProgress });
      }
    }

    if (payload.duration && activeYTPlayer && activeYTPlayer.seekTo) {
      try {
        activeYTPlayer.seekTo(desiredProgress, true);
      } catch (err) {
        console.warn('seek fail', err);
      }
    }

    if (activeYTPlayer) {
      activeYTPlayer.unMute();
      activeYTPlayer.playVideo();
    }

    setPlayButtonState('playing');
    isPlaying = true;
  }

  if (payload.next_video_id) {
    preloadNextVideo(payload.next_video_id);
  }

  if (payload.duration && payload.progress >= (payload.duration - 0.5) && standbyVideoId) {
    if (!transitionSwapped) {
      swapToStandbyPlayer();
      setPlayButtonState('playing');
      isPlaying = true;
    }
  }

  if (payload.duration && payload.progress >= (payload.duration - 4)) {
    const currentSecs = activeYTPlayer && activeYTPlayer.getCurrentTime ? activeYTPlayer.getCurrentTime() : 0;
    const offset = ((payload.progress + latencyMs / 2000) - currentSecs);
    const adjust = Math.max(0.95, Math.min(1.05, 1 + (offset / 7)));
    if (!isNaN(adjust)) setPlaybackRateForActive(adjust);
  } else {
    setPlaybackRateForActive(1);
  }
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
  const sourceList = Array.isArray(items) ? items : (Array.isArray(dataExample.queue) ? dataExample.queue : []);
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

function renderUsers() {
  userBank.innerHTML = '';
  dataExample.users.forEach((user) => {
    const el = document.createElement('div');
    el.className = 'user-item';
    el.setAttribute('data-name', user.name);
    el.innerHTML = `<img src="${user.avatar}" alt="${user.name}">`;
    el.addEventListener('mouseenter', () => { el.style.filter = 'blur(0.3px)'; });
    el.addEventListener('mouseleave', () => { el.style.filter = 'none'; });
    userBank.appendChild(el);
  });
}

async function togglePlay() {
  unlockYTPlayers();
  if (!activeYTPlayer || isSyncLoading) return;
  const playerState = activeYTPlayer.getPlayerState();
  if (playerState === YT.PlayerState.PLAYING) {
    activeYTPlayer.pauseVideo();
    setPlayButtonState('paused');
    isPlaying = false;
    return;
  }

  setPlayButtonState('loading');
  await measureLatency();

  if (lastPayload && typeof lastPayload.progress === 'number') {
    const desired = lastPayload.progress + latencyMs / 2000;
    try {
      activeYTPlayer.seekTo(desired, true);
    } catch (err) { console.warn('seek fail', err); }
  }

  activeYTPlayer.playVideo();
  setTimeout(() => {
    if (activeYTPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
      setPlayButtonState('playing');
      isPlaying = true;
    } else {
      setPlayButtonState('paused');
      isPlaying = false;
    }
  }, 250);
}

function setTrack(idx) {
  const total = dataExample.queue.length + 1;
  activeTrackIndex = ((idx % total) + total) % total;
  currentTrack = activeTrackIndex === 0 ? dataExample.currentTrack : dataExample.queue[activeTrackIndex - 1];
  updateTrackInfo(currentTrack);

  if (currentTrack.videoId) {
    activeVideoId = currentTrack.videoId;
    activeYTPlayer.loadVideoById(activeVideoId);
    activeYTPlayer.unMute();
    activeYTPlayer.playVideo();
    setPlayButtonState('playing');
    isPlaying = true;
  }
}

function playNext() {
  if (shuffleMode) {
    const options = [...Array(dataExample.queue.length + 1).keys()].filter((i) => i !== activeTrackIndex);
    const randomIndex = options[Math.floor(Math.random() * options.length)];
    setTrack(randomIndex);
  } else if (repeatMode) {
    setTrack(activeTrackIndex);
  } else {
    setTrack(activeTrackIndex + 1);
  }
}

function playPrev() {
  if (shuffleMode) {
    const options = [...Array(dataExample.queue.length + 1).keys()].filter((i) => i !== activeTrackIndex);
    const randomIndex = options[Math.floor(Math.random() * options.length)];
    setTrack(randomIndex);
  } else {
    setTrack(activeTrackIndex - 1);
  }
}

function refreshProgressDisplay() {
  if (!activeYTPlayer || !activeYTPlayer.getCurrentTime) return;
  const duration = activeYTPlayer.getDuration ? activeYTPlayer.getDuration() : 0;
  const current = activeYTPlayer.getCurrentTime ? activeYTPlayer.getCurrentTime() : 0;
  progress.value = duration ? (current / duration) * 100 : 0;
  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
}

setInterval(refreshProgressDisplay, 400);

progress.addEventListener('input', () => {
  if (!activeYTPlayer || !activeYTPlayer.getDuration) return;
  const duration = activeYTPlayer.getDuration();
  if (!duration) return;
  const target = (progress.value / 100) * duration;
  activeYTPlayer.seekTo(target, true);
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
  audio.volume = volumeSlider.value;
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

  dataExample.users[0] = { name, avatar: photo };
  renderUsers();
  statusFile.textContent = `Arquivo de listeners: perfil ${name} atualizado`;
  settingsPanel.classList.add('hidden');

  const payload = await postProfile(name, photo);
  if (payload) {
    renderListeners(payload.usuarios || []);
    renderQueue(payload.fila || []);
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
  const hasAutoApi = tryAutoConfigureFromUrl();
  setTimeout(() => {
    serverStatusText.textContent = 'JAM Spotify ON';
    connectionIcon.textContent = hasAutoApi ? '🟡' : '🟢';
    apiLinkInput.value = API_BASE;
    if (!hasAutoApi) {
      setConnectionStatus(true, 'Pronto');
    }
    updateTrackInfo(dataExample.currentTrack);
    renderQueue(dataExample.queue);
    renderUsers();
    startLyricsRotation();
    statusFile.textContent = 'Arquivo de listeners: 4 ouvintes conectados';
    profileName.value = dataExample.users[0].name;
    profilePreview.src = dataExample.users[0].avatar;
    renderListeners(dataExample.users);
    postProfile(dataExample.users[0].name, dataExample.users[0].avatar).then((payload) => {
      if (payload) {
        renderListeners(payload.usuarios || dataExample.users);
        renderQueue(payload.fila || dataExample.queue);
      }
    });
    if (!hasAutoApi) {
      startServerSync();
    }
  }, 1500);
}

init();
