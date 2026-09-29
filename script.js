(() => {
  const content = window.BIRTHDAY_CONTENT;
  if (!content) return;

  const letters = content.letters;
  const memories = content.memories;
  const galleryEntries = memories.filter((photo) => photo.src);
  const envelopeGrid = document.querySelector('#envelope-grid');
  const letterDialog = document.querySelector('#letter-dialog');
  const audio = document.querySelector('#shared-audio');
  const openingAudio = document.querySelector('#opening-audio');
  const openingAudioControl = document.querySelector('#opening-audio-control');
  const vinyl = document.querySelector('#vinyl');
  const playButton = document.querySelector('#play-button');
  const spotifyEmbedShell = document.querySelector('#spotify-embed-shell');
  let spotifyEmbed = null;
  const spotifyOpenLink = document.querySelector('#spotify-open-link');
  const audioControls = document.querySelector('.audio-controls');
  const persistentPlayer = document.querySelector('#persistent-player');
  const persistentPlay = document.querySelector('#persistent-play');
  let activeLetterIndex = -1;
  let returnFocusTo = null;
  let currentAudioLetterId = null;
  let touchStart = null;
  let activePhotoIndex = 0;
  let spotifyController = null;

  const byId = (id) => document.getElementById(id);
  const setText = (id, text) => { byId(id).textContent = text ?? ''; };
  const formatTime = (value) => {
    if (!Number.isFinite(value)) return '0:00';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  function makeEnvelope(letter, index) {
    const button = document.createElement('button');
    const status = letter.isPlaceholder ? '' : 'Tap to open your letter';
    button.type = 'button';
    button.className = `envelope-button envelope-${index % 3}`;
    button.setAttribute('aria-label', `Open letter ${index + 1} from ${letter.senderName} to ${content.SITE.recipientName}`);
    button.innerHTML = `<span class="envelope-person-name handwritten">${escapeHTML(letter.senderName)}</span><span class="envelope-art" aria-hidden="true"><span class="envelope-lace"></span><span class="envelope-paper"></span><span class="envelope-flap"></span><span class="envelope-seal">♡</span><span class="envelope-label"><span>To ${escapeHTML(content.SITE.recipientName)}</span><span>From ${escapeHTML(letter.senderName)}</span></span><span class="envelope-postmark">✿</span></span><span class="envelope-status" aria-live="polite">${status}</span>`;
    button.addEventListener('click', () => beginLetterOpening(button, index));
    return button;
  }

  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function stopOpeningAudio() {
    openingAudio.pause();
    openingAudioControl.setAttribute('aria-pressed', 'false');
    openingAudioControl.querySelector('span').textContent = 'Play the birthday song';
  }

  function updateOpeningAudioControl() {
    const isPlaying = !openingAudio.paused && !openingAudio.ended;
    openingAudioControl.setAttribute('aria-pressed', String(isPlaying));
    openingAudioControl.querySelector('span').textContent = isPlaying ? 'Pause the birthday song' : 'Play the birthday song';
  }

  function mountSpotifyPlayer(song) {
    const frame = document.createElement('iframe');
    frame.title = `${song.title} — ${song.artist} Spotify player`;
    frame.src = song.spotifyEmbedUrl;
    frame.width = '100%';
    frame.height = '152';
    frame.loading = 'eager';
    frame.allowFullscreen = true;
    frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    frame.style.border = '0';
    frame.style.borderRadius = '12px';
    spotifyEmbedShell.replaceChildren();
    spotifyEmbedShell.append(frame);
    stopOpeningAudio();
    frame.addEventListener('pointerdown', stopOpeningAudio, { once: true });
  }

  const birthdayHeading = byId('hero-title');
  birthdayHeading.replaceChildren(document.createTextNode(content.SITE.greeting));
  birthdayHeading.append(document.createElement('br'));
  const recipient = document.createElement('em');
  recipient.textContent = content.SITE.recipientName;
  birthdayHeading.append(recipient);
  setText('hero-intro', content.SITE.intro);
  setText('closing-title', content.SITE.closingMessage);

  if (content.SITE.openingAudioSrc) {
    openingAudio.src = content.SITE.openingAudioSrc;
    openingAudioControl.hidden = false;
    openingAudio.addEventListener('play', updateOpeningAudioControl);
    openingAudio.addEventListener('pause', updateOpeningAudioControl);
    openingAudio.addEventListener('ended', updateOpeningAudioControl);
    openingAudio.addEventListener('error', () => {
      stopOpeningAudio();
      openingAudioControl.querySelector('span').textContent = 'Birthday audio could not be loaded';
      openingAudioControl.disabled = true;
    });
    openingAudioControl.addEventListener('click', async () => {
      if (!openingAudio.paused) {
        stopOpeningAudio();
        return;
      }
      try {
        await openingAudio.play();
      } catch {
        openingAudioControl.querySelector('span').textContent = 'Tap to play the birthday song';
      }
    });
    openingAudio.play().catch(() => {
      openingAudioControl.querySelector('span').textContent = 'Tap to play the birthday song';
    });
  }

  function beginLetterOpening(button, index) {
    if (button.disabled) return;
    button.disabled = true;
    button.classList.add('is-opening');
    returnFocusTo = button;
    window.setTimeout(() => {
      button.classList.remove('is-opening');
      button.classList.add('is-opened');
      button.disabled = false;
      showLetter(index);
      if (!letterDialog.open) letterDialog.showModal();
      persistentPlayer.hidden = true;
      byId('dialog-salutation').focus?.({ preventScroll: true });
      letterDialog.scrollTop = 0;
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520);
  }

  function showLetter(index) {
    const letter = letters[index];
    letterDialog.removeAttribute('aria-labelledby');
    letterDialog.setAttribute('aria-label', `A letter from ${letter.senderName} to ${content.SITE.recipientName}`);
    const changedLetter = activeLetterIndex !== index;
    activeLetterIndex = index;
    const senderPhotoIndex = galleryEntries.findIndex((photo) => photo.senderId === letter.id);
    if (senderPhotoIndex >= 0) activePhotoIndex = senderPhotoIndex;
    const salutation = byId('dialog-salutation');
    salutation.textContent = letter.salutation;
    salutation.hidden = !letter.salutation;
    salutation.setAttribute('tabindex', '-1');
    const paragraphs = byId('dialog-paragraphs');
    paragraphs.replaceChildren(...letter.paragraphs.map((text) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    setText('dialog-signature', letter.signature);
    byId('dialog-signature').hidden = !letter.signature;
    const photos = byId('letter-photos');
    photos.replaceChildren(...(letter.photos || []).map((photo) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Open ${photo.alt}`);
      const image = document.createElement('img');
      image.src = photo.src;
      image.alt = photo.alt;
      image.loading = 'lazy';
      button.append(image);
      button.addEventListener('click', () => openLightbox(photo));
      return button;
    }));
    photos.hidden = !(letter.photos || []).length;
    setText('letter-from', letter.id === 'kai' ? `With love, ${letter.senderName}` : '');
    byId('letter-from').hidden = letter.id !== 'kai';
    setText('letter-position', `${index + 1} / ${letters.length}`);
    renderMemories();
    byId('letter-prev').disabled = index === 0;
    byId('letter-next').disabled = index === letters.length - 1;
    const song = letter.song;
    setText('song-meta', `${song.title} · ${song.artist}`);
    const reason = byId('song-reason');
    reason.textContent = song.reason || '';
    reason.hidden = !song.reason;
    const hasAudio = Boolean(song.audioSrc);
    const hasSpotifyEmbed = Boolean(song.spotifyEmbedUrl);
    const hasSong = hasSpotifyEmbed || hasAudio;
    document.querySelector('.record-side').hidden = !hasSong;
    document.querySelector('.dialog-layout').classList.toggle('without-song', !hasSong);
    playButton.disabled = !hasAudio;
    playButton.hidden = hasSpotifyEmbed;
    vinyl.hidden = hasSpotifyEmbed;
    audioControls.hidden = hasSpotifyEmbed || !hasAudio;
    spotifyEmbedShell.hidden = !hasSpotifyEmbed;
    spotifyEmbedShell.replaceChildren();
    spotifyEmbed = null;
    if (hasSpotifyEmbed) mountSpotifyPlayer(song);
    spotifyOpenLink.hidden = !song.spotifyUrl;
    if (song.spotifyUrl) spotifyOpenLink.href = song.spotifyUrl;
    byId('missing-audio').hidden = hasAudio || hasSpotifyEmbed;
    if (!hasAudio && !hasSpotifyEmbed) setText('missing-audio', 'This song is waiting to be added.');
    setText('persistent-title', hasAudio || hasSpotifyEmbed ? `${song.title} · ${song.artist}` : 'Song waiting to be added');
    setText('persistent-sender', letter.senderName);
    persistentPlay.disabled = !hasAudio;
    persistentPlayer.hidden = !hasAudio || letterDialog.open;
    playButton.querySelector('span').textContent = hasAudio ? 'Play song' : 'Song waiting to be added';
    vinyl.setAttribute('aria-label', hasAudio ? `Pink vinyl for ${song.title} by ${song.artist}` : 'Pink vinyl; this song is waiting to be added');

    if (changedLetter) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      currentAudioLetterId = letter.id;
      if (hasAudio) {
        audio.src = song.audioSrc;
        audio.load();
      }
    }
    updateAudioUI();
    letterDialog.scrollTop = 0;
  }

  function updateAudioUI() {
    const playing = !audio.paused && !audio.ended;
    vinyl.classList.toggle('is-playing', playing);
    vinyl.classList.toggle('is-buffering', audio.readyState < 3 && !audio.paused && !audio.error);
    playButton.setAttribute('aria-label', playing ? 'Pause selected song' : 'Play selected song');
    if (playButton.querySelector('span')) playButton.querySelector('span').textContent = playing ? 'Pause song' : (audio.src ? 'Play song' : 'Song waiting to be added');
    playButton.firstChild.textContent = playing ? 'Ⅱ ' : '▶ ';
    persistentPlay.textContent = playing ? 'Ⅱ' : '▶';
    persistentPlay.setAttribute('aria-label', playing ? 'Pause selected song' : 'Play selected song');
    setText('persistent-state', playing ? '♫' : '♡');
    byId('audio-seek').disabled = !Number.isFinite(audio.duration) || !audio.duration;
    byId('audio-seek').max = Number.isFinite(audio.duration) ? String(audio.duration) : '0';
    byId('audio-seek').value = String(audio.currentTime || 0);
    setText('audio-current', formatTime(audio.currentTime));
    setText('audio-duration', formatTime(audio.duration));
  }

  async function togglePlayback() {
    const letter = letters[activeLetterIndex];
    if (!letter?.song.audioSrc) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setText('missing-audio', 'Playback could not start. Check that the audio file is available.');
      byId('missing-audio').hidden = false;
      vinyl.classList.remove('is-playing');
    }
  }

  // Decode nearby photos before navigation; keep the current photo until the next is ready.
  const cameraPhotoCache = new Map();
  let cameraRenderVersion = 0;

  function prepareCameraPhoto(photo, priority = 'low') {
    let cached = cameraPhotoCache.get(photo.src);
    if (cached) {
      cached.image.fetchPriority = priority;
      return cached;
    }
    const image = new Image();
    image.alt = photo.alt || '';
    image.loading = 'eager';
    image.decoding = 'async';
    image.fetchPriority = priority;
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `${photo.alt || 'Memory photo'}. Open larger image`);
    image.addEventListener('click', () => openLightbox(photo));
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(photo);
      }
    });
    cached = { image, ready: false, promise: null };
    image.src = photo.src;
    cached.promise = image.decode().then(() => {
      cached.ready = true;
      return image;
    }).catch((error) => {
      cameraPhotoCache.delete(photo.src);
      throw error;
    });
    cameraPhotoCache.set(photo.src, cached);
    return cached;
  }

  function preloadNearbyPhotos(index) {
    const keep = new Set();
    for (const offset of [0, 1, -1, 2, -2]) {
      const photo = galleryEntries[(index + offset + galleryEntries.length) % galleryEntries.length];
      keep.add(photo.src);
      if (offset) prepareCameraPhoto(photo).promise.catch(() => {});
    }
    // Limit decoded image memory, especially on phones.
    for (const src of cameraPhotoCache.keys()) {
      if (!keep.has(src)) cameraPhotoCache.delete(src);
    }
  }

  function renderMemories() {
    const screen = byId('camera-screen');
    const count = galleryEntries.length;
    const version = ++cameraRenderVersion;
    byId('photo-prev').disabled = count < 2;
    byId('photo-next').disabled = count < 2;
    if (!count) {
      setText('photo-count', '0 / 0');
      return;
    }
    activePhotoIndex = Math.min(activePhotoIndex, count - 1);
    const index = activePhotoIndex;
    const photo = galleryEntries[index];
    const cached = prepareCameraPhoto(photo, 'high');
    const showPhoto = () => {
      if (version !== cameraRenderVersion) return;
      if (screen.firstElementChild !== cached.image) screen.replaceChildren(cached.image);
      screen.setAttribute('aria-busy', 'false');
      setText('gallery-caption', photo.caption || 'A little moment, kept close.');
      setText('photo-count', `${index + 1} / ${count}`);
      preloadNearbyPhotos(index);
    };
    screen.setAttribute('aria-busy', 'true');
    if (cached.ready) showPhoto();
    else cached.promise.then(showPhoto).catch(() => {
      if (version !== cameraRenderVersion) return;
      screen.setAttribute('aria-busy', 'false');
      setText('gallery-caption', 'This photo could not load. Try another photo.');
    });
  }

  function changePhoto(direction) {
    if (galleryEntries.length < 2) return;
    activePhotoIndex = (activePhotoIndex + direction + galleryEntries.length) % galleryEntries.length;
    renderMemories();
    if (byId('photo-lightbox').open) {
      const photo = galleryEntries[activePhotoIndex];
      if (photo.src) {
        byId('lightbox-image').src = photo.src;
        byId('lightbox-image').alt = photo.alt || '';
        setText('lightbox-caption', photo.caption || '');
      } else {
        byId('photo-lightbox').close();
      }
    }
  }

  function openLightbox(photo) {
    if (!photo.src) return;
    byId('lightbox-image').src = photo.src;
    byId('lightbox-image').alt = photo.alt || '';
    setText('lightbox-caption', photo.caption || '');
    byId('photo-lightbox').showModal();
  }

  letters.forEach((letter, index) => envelopeGrid.append(makeEnvelope(letter, index)));
  renderMemories();
  audio.addEventListener('play', updateAudioUI);
  audio.addEventListener('pause', updateAudioUI);
  audio.addEventListener('timeupdate', updateAudioUI);
  audio.addEventListener('durationchange', updateAudioUI);
  audio.addEventListener('loadedmetadata', updateAudioUI);
  audio.addEventListener('waiting', updateAudioUI);
  audio.addEventListener('stalled', updateAudioUI);
  audio.addEventListener('seeking', updateAudioUI);
  audio.addEventListener('canplay', updateAudioUI);
  audio.addEventListener('ended', updateAudioUI);
  audio.addEventListener('error', () => {
    updateAudioUI();
    if (currentAudioLetterId) {
      byId('missing-audio').hidden = false;
      setText('missing-audio', 'This song could not be loaded. Check the audio file path.');
    }
  });
  playButton.addEventListener('click', togglePlayback);
  persistentPlay.addEventListener('click', togglePlayback);
  byId('audio-seek').addEventListener('input', (event) => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.currentTarget.value);
  });
  byId('audio-volume').addEventListener('input', (event) => { audio.volume = Number(event.currentTarget.value); });
  byId('letter-prev').addEventListener('click', () => showLetter(Math.max(activeLetterIndex - 1, 0)));
  byId('letter-next').addEventListener('click', () => showLetter(Math.min(activeLetterIndex + 1, letters.length - 1)));
  byId('letter-dialog').querySelector('.dialog-close').addEventListener('click', () => letterDialog.close());
  letterDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    letterDialog.close();
  });
  letterDialog.addEventListener('close', () => {
    if (letterDialog.open) return;
    spotifyEmbedShell.replaceChildren();
    spotifyEmbedShell.hidden = true;
    spotifyEmbed = null;
    if (returnFocusTo?.isConnected) returnFocusTo.focus();
    returnFocusTo = null;
    persistentPlayer.hidden = !letters[activeLetterIndex]?.song.audioSrc;
  });
  byId('photo-prev').addEventListener('click', () => changePhoto(-1));
  byId('photo-next').addEventListener('click', () => changePhoto(1));
  byId('camera-screen').addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  byId('camera-screen').addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) changePhoto(dx < 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });
  byId('photo-lightbox').querySelector('.lightbox-close').addEventListener('click', () => byId('photo-lightbox').close());
  byId('photo-lightbox').addEventListener('cancel', (event) => {
    event.preventDefault();
    byId('photo-lightbox').close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (byId('photo-lightbox').open) byId('photo-lightbox').close();
      else if (letterDialog.open) letterDialog.close();
    }
    if (letterDialog.open && event.key === 'ArrowLeft') byId('letter-prev').click();
    if (letterDialog.open && event.key === 'ArrowRight') byId('letter-next').click();
    if (byId('photo-lightbox').open && event.key === 'ArrowLeft') changePhoto(-1);
    if (byId('photo-lightbox').open && event.key === 'ArrowRight') changePhoto(1);
  });
})();