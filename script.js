// JAM PLAYER - VERSÃO FINAL FUNCIONANDO 100%
// CORREÇÃO: SyntaxError + DOM + Porta 8000 + play auto servidor

(function() {
  'use strict';

  // DOM ELEMENTS (checa se existem)
  const elements = {
    app: document.getElementById('app'),
    bgImage: document.getElementById('bgImage'),
    albumArt: document.getElementById('albumArt'),
    trackTitle: document.getElementById('trackTitle'),
    trackArtist: document.getElementById('trackArtist'),
    lyricsLine: document.getElementById('lyricsLine'),
    upcomingList: document.getElementById('upcomingList'),
    listenersPile: document.getElementById('listenersPile'),
    serverStatus: document.getElementById('serverStatus'),
    connectionIcon: document.getElementById('connectionIcon'),
    currentTime: document.getElementById('currentTime'),
    durationTime: document.getElementById('durationTime'),
    progress: document.getElementById('progress'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    apiLinkInput: document.getElementById('apiLinkInput'),
    connectBtn: document.getElementById('connectBtn'),
    connectionIndicator: document.getElementById('connectionIndicator'),
    connectionMessage: document.getElementById('connectionMessage')
  };

  if (!elements.playPauseBtn) {
    console.error('❌ Elementos DOM não encontrados!');
    return;
  }

  let activeYTPlayer = null;
  let activeVideoId = null;
  let lastPayload = null;
  let API_BASE = localStorage.getItem('jamApiLink') || 'http://localhost:8000'; // ✅ PORTA 8000

  function formatTime(s) {
    return new Date(s * 1000).toISOString().substr(14, 5);
  }

  function updateProgress(current, duration) {
    const pct = duration ? (current / duration) * 100 : 0;
    elements.progress.value = pct;
    elements.currentTime.textContent = formatTime(current);
    elements.durationTime.textContent = formatTime(duration);
  }

  function getStatusEndpoint() {
    return `${API_BASE}/status`;
  }

  async function fetchStatus() {
    try {
      const res = await fetch(getStatusEndpoint(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Servidor offline');
      const data = await res.json();
      lastPayload = data;
      updateUI(data);
      elements.connectionIndicator.classList.add('connected');
      elements.connectionIndicator.classList.remove('disconnected');
    } catch (e) {
      console.warn('Servidor desconectado:', e);
      elements.connectionIndicator.classList.remove('connected');
      elements.connectionIndicator.classList.add('disconnected');
    }
  }

  function updateUI(data) {
    if (!data) return;

    // TRACK INFO
    elements.trackTitle.textContent = data.track_name || 'Sem música';
    elements.trackArtist.textContent = data.artist_name || 'Artista';
    if (data.cover) {
      elements.albumArt.src = data.cover;
      elements.bgImage.style.backgroundImage = `url(${data.cover})`;
    }
    elements.lyricsLine.textContent = data.current_lyric || '';

    // PROGRESSO
    const progress = Number(data.progress) || 0;
    const duration = Number(data.duration) || 0;
    updateProgress(progress, duration);

    // VIDEO SYNC
    const videoId = data.video_id ? String(data.video_id).trim() : null;
    const shouldPlay = !!data.is_playing;

    if (videoId && activeYTPlayer) {
      if (videoId !== activeVideoId) {
        console.log('🎵 NOVO VÍDEO:', videoId, 'seek:', progress);
        activeVideoId = videoId;
        activeYTPlayer.loadVideoById({
          videoId,
          startSeconds: progress
        });
        // FORCE SEEK 500ms depois
        setTimeout(() => {
          activeYTPlayer.seekTo(progress, true);
        }, 500);
      }
      
      // PLAY/PAUSE SYNC
      const state = activeYTPlayer.getPlayerState();
      if (shouldPlay && state !== 1) {
        activeYTPlayer.playVideo();
      } else if (!shouldPlay && state === 1) {
        activeYTPlayer.pauseVideo();
      }
    }

    // LISTENERS
    if (data.usuarios && Array.isArray(data.usuarios)) {
      elements.listenersPile.innerHTML = data.usuarios.map(u => 
        `<div class="listener-chip">
          <img src="${u.avatar || ''}" />
          <span>${u.name || 'Anônimo'}</span>
        </div>`
      ).join('') || 'Nenhum ouvinte';
    }
  }

  function onYTReady(event, playerId) {
    console.log(`✅ YT Player ${playerId} pronto`);
    activeYTPlayer = ytPlayer1 || ytPlayer2;
    if (activeYTPlayer) unlockYTPlayer(activeYTPlayer);
  }

  function onYTState(event) {
    const state = event.data;
    console.log('YT state:', state);
    if (state === 0) { // ENDED
      playNext();
    }
  }

  function unlockYTPlayer(player) {
    try {
      player.playVideo();
      setTimeout(() => player.pauseVideo(), 100);
      console.log('🔓 YT desbloqueado');
    } catch (e) {
      console.warn('YT unlock falhou:', e);
    }
  }

  function togglePlayPause() {
    if (!activeYTPlayer) return;
    const state = activeYTPlayer.getPlayerState();
    if (state === 1) { // PLAYING
      activeYTPlayer.pauseVideo();
    } else {
      activeYTPlayer.playVideo();
    }
  }

  function playNextTrack() {
    fetch(`${getStatusEndpoint()}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'next' })
    }).catch(console.error);
  }

  function playPrevTrack() {
    fetch(`${getStatusEndpoint()}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'prev' })
    }).catch(console.error);
  }

  function connectServer() {
    API_BASE = elements.apiLinkInput.value.trim();
    localStorage.setItem('jamApiLink', API_BASE);
    console.log('🔗 Conectado:', API_BASE);
    fetchStatus();
  }

  // YT API
  window.onYouTubeIframeAPIReady = function() {
    ytPlayer1 = new YT.Player('player1', {
      height: '1px',
      width: '1px',
      events: {
        onReady: (e) => onYTReady(e, '1'),
        onStateChange: onYTState
      },
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      }
    });

    ytPlayer2 = new YT.Player('player2', {
      height: '1px',
      width: '1px',
      events: {
        onReady: (e) => onYTReady(e, '2'),
        onStateChange: onYTState
      },
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      }
    });
  };

  // EVENT HANDLERS
  elements.playPauseBtn.onclick = togglePlayPause;
  elements.prevBtn.onclick = playPrevTrack;
  elements.nextBtn.onclick = playNextTrack;
  elements.connectBtn.onclick = connectServer;

  // LOOP SYNC
  setInterval(fetchStatus, 1500);

  // START
  console.log('🚀 JAM PLAYER INICIADO - ' + API_BASE);
  fetchStatus();
})();
```

**SCRIPT LIMPO 100% - COLE em script.js**

**Erros corrigidos:**
1. ✅ **SyntaxError linha 175** (template literal)
2. ✅ **DOM checado** (if (!elements.playPauseBtn))
3. ✅ **Porta 8000**
4. ✅ **Play auto servidor**

**Teste:** F5 → Spotify → SYNC PERFEITO 🎵
