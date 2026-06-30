/**
 * Swiper View — manages the main character card swiper, controller bar, autoplay, and volume.
 */
const SwiperView = (() => {
  const IMAGE_BASE = 'public/images';

  let swiperEl     = null;
  let progressEl   = null;
  let positionEl   = null;
  let playBtn      = null;
  let volumeBtn    = null;
  let volumePopup  = null;
  let volumeSlider = null;

  let characters      = [];
  let currentIndex    = 0;
  let isPlaying       = false;
  let localVolume     = 0;
  let lastSpokenId    = null;
  let onSettingsClick = null;
  let onBrowseClick   = null;
  let onQuizClick     = null;

  let lastMovieFilter = null;
  let lastSortOrder   = null;

  let rafId           = 0;
  let elapsedMs       = 0;
  let rafStartTime    = 0;
  let rafSavedElapsed = 0;

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function getSettings() { return Settings.get(); }

  function updatePosition() {
    if (positionEl) positionEl.textContent = `${currentIndex + 1} / ${characters.length}`;
  }

  function updateVolumeIcon() {
    if (!volumeBtn) return;
    volumeBtn.textContent = localVolume === 0 ? '🔇' : localVolume < 0.5 ? '🔉' : '🔊';
  }

  function updatePlayButton() {
    if (!playBtn) return;
    playBtn.textContent = isPlaying ? '⏹' : '⏵';
    playBtn.setAttribute('aria-label', isPlaying ? 'Stop autoplay' : 'Play');
  }

  function stopRaf(saveProgress) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (saveProgress && rafStartTime > 0) {
      elapsedMs = rafSavedElapsed + (performance.now() - rafStartTime);
    }
  }

  function startRaf() {
    stopRaf(false);
    const duration  = getSettings().autoSwipeTimeout * 1000;
    rafStartTime    = performance.now();
    rafSavedElapsed = elapsedMs;

    if (progressEl) {
      progressEl.style.width = `${Math.min((elapsedMs / duration) * 100, 100)}%`;
    }

    let done = false;
    function tick() {
      if (done) return;
      const elapsed = rafSavedElapsed + (performance.now() - rafStartTime);
      const pct     = Math.min((elapsed / duration) * 100, 100);
      if (progressEl) progressEl.style.width = `${pct}%`;
      if (elapsed >= duration) {
        done = true;
        swiperEl?.swiper?.slideNext();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function handlePlayToggle() {
    if (isPlaying) {
      isPlaying    = false;
      lastSpokenId = null;
      stopRaf(true);
    } else {
      isPlaying = true;
      const char = characters[currentIndex];
      if (char) {
        lastSpokenId = char.id;
        TTS.speak(char.id, getSettings().voiceURI ?? 'samantha', localVolume);
      }
      startRaf();
    }
    updatePlayButton();
  }

  function buildSlides(chars) {
    const wrapEl = document.getElementById('swiper-wrapper-div');
    const oldEl  = document.getElementById('character-swiper');
    if (oldEl?.swiper) {
      try { oldEl.swiper.destroy(true, true); } catch (_) {}
    }

    const newEl = document.createElement('swiper-container');
    newEl.id    = 'character-swiper';
    newEl.setAttribute('init', 'false');
    newEl.style.cssText = 'width:100%;height:100%';
    if (oldEl) wrapEl.replaceChild(newEl, oldEl);
    else wrapEl.appendChild(newEl);
    swiperEl = newEl;

    chars.forEach(char => {
      const slide    = document.createElement('swiper-slide');
      const safeId   = esc(char.id);
      const safeName = esc(char.name);
      slide.innerHTML = `
        <div class="card">
          <img class="card-image"
               src="${IMAGE_BASE}/${safeId}.webp"
               alt="${safeName}"
               data-character-name="${safeName}"
               data-character-id="${safeId}">
          <p class="card-name">${safeName}</p>
        </div>`;
      slide.querySelector('.card-image').addEventListener('click', e => {
        e.stopPropagation();
        TTS.speak(char.id, getSettings().voiceURI ?? 'samantha', localVolume);
      });
      swiperEl.appendChild(slide);
    });
  }

  function initSwiper(initialSlide) {
    const s = getSettings();
    Object.assign(swiperEl, {
      loop:          true,
      slidesPerView: 1,
      initialSlide,
      autoplay: { delay: s.autoSwipeTimeout * 1000, disableOnInteraction: false },
    });
    swiperEl.initialize();
    swiperEl.swiper?.autoplay.stop();

    swiperEl.addEventListener('swiperslidechange', () => {
      const swiper = swiperEl.swiper;
      if (!swiper) return;
      requestAnimationFrame(() => {
        const realIdx     = swiper.realIndex;

        // Swiper fires swiperslidechange internally during loop setup;
        // realIndex is not valid yet at that point — skip those events.
        if (!Number.isFinite(realIdx)) return;

        const activeSlide = swiper.slides?.[swiper.activeIndex];
        const idFromDom   = activeSlide
          ?.querySelector('[data-character-id]')
          ?.getAttribute('data-character-id');

        currentIndex = realIdx;
        elapsedMs    = 0;
        if (progressEl && !isPlaying) progressEl.style.width = '0%';
        updatePosition();

        const id = idFromDom ?? characters[realIdx]?.id;
        if (id && id !== lastSpokenId) {
          lastSpokenId = id;
          TTS.speak(id, getSettings().voiceURI ?? 'samantha', localVolume);
        }
        TTS.preloadAround(
          getSettings().voiceURI ?? 'samantha',
          characters.map(c => c.id),
          realIdx,
        );
        if (isPlaying) startRaf();
      });
    });
  }

  function closeVolumePopup() {
    if (volumePopup) volumePopup.hidden = true;
  }

  function toggleVolumePopup() {
    if (!volumePopup) return;
    const opening = volumePopup.hidden;
    volumePopup.hidden = !opening;
    if (opening) {
      setTimeout(() => {
        function outsideClick(e) {
          if (!document.getElementById('volume-control')?.contains(e.target)) {
            closeVolumePopup();
            document.removeEventListener('click', outsideClick);
          }
        }
        document.addEventListener('click', outsideClick);
      }, 100);
    }
  }

  function init(callbacks) {
    onSettingsClick = callbacks.onSettingsClick;
    onBrowseClick   = callbacks.onBrowseClick;
    onQuizClick     = callbacks.onQuizClick;

    progressEl   = document.getElementById('timeline-fill');
    positionEl   = document.getElementById('position-indicator');
    playBtn      = document.getElementById('btn-play');
    volumeBtn    = document.getElementById('btn-volume');
    volumePopup  = document.getElementById('volume-popup');
    volumeSlider = document.getElementById('volume-slider');

    const s     = getSettings();
    localVolume = s.volume;
    lastMovieFilter = s.movieFilter;
    lastSortOrder   = s.sortOrder;
    if (volumeSlider) volumeSlider.value = localVolume;
    updateVolumeIcon();

    document.getElementById('btn-settings').addEventListener('click', () => onSettingsClick?.());
    document.getElementById('btn-browse').addEventListener('click',   () => onBrowseClick?.());
    document.getElementById('btn-quiz').addEventListener('click',     () => onQuizClick?.());
    playBtn.addEventListener('click', handlePlayToggle);

    document.getElementById('btn-to-start').addEventListener('click', () => {
      elapsedMs = 0; if (isPlaying) stopRaf(false);
      swiperEl?.swiper?.slideToLoop(0);
      if (isPlaying) startRaf();
    });
    document.getElementById('btn-prev').addEventListener('click', () => {
      elapsedMs = 0; swiperEl?.swiper?.slidePrev();
    });
    document.getElementById('btn-next').addEventListener('click', () => {
      elapsedMs = 0; swiperEl?.swiper?.slideNext();
    });
    document.getElementById('btn-to-end').addEventListener('click', () => {
      elapsedMs = 0; if (isPlaying) stopRaf(false);
      swiperEl?.swiper?.slideToLoop(characters.length - 1);
      if (isPlaying) startRaf();
    });

    volumeBtn.addEventListener('click', toggleVolumePopup);
    volumeSlider.addEventListener('input', () => {
      localVolume = parseFloat(volumeSlider.value);
      Settings.update({ volume: localVolume });
      updateVolumeIcon();
    });

    document.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (document.getElementById('swiper-view').hidden) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':      e.preventDefault(); handlePlayToggle(); break;
        case 'ArrowLeft':  e.preventDefault(); swiperEl?.swiper?.slidePrev(); break;
        case 'ArrowRight': e.preventDefault(); swiperEl?.swiper?.slideNext(); break;
      }
    });

    Settings.subscribe(newS => {
      if (newS.movieFilter !== lastMovieFilter || newS.sortOrder !== lastSortOrder) {
        lastMovieFilter = newS.movieFilter;
        lastSortOrder   = newS.sortOrder;
        rebuild(null);
      }
    });
  }

  function rebuild(startCharacterId) {
    if (isPlaying) {
      isPlaying = false;
      stopRaf(false);
      updatePlayButton();
      if (progressEl) progressEl.style.width = '0%';
    }
    elapsedMs = 0; lastSpokenId = null;

    const s = getSettings();
    let chars = Characters.getFiltered(s.movieFilter);
    chars = Characters.sort(chars, s.sortOrder);

    if (startCharacterId && s.sortOrder === 'random') {
      const idx = chars.findIndex(c => c.id === startCharacterId);
      if (idx > 0) { const [c] = chars.splice(idx, 1); chars = [c, ...chars]; }
    }

    characters = chars;
    const emptyEl = document.getElementById('empty-state');
    const wrapEl  = document.getElementById('swiper-wrapper-div');

    if (characters.length === 0) {
      if (emptyEl) { emptyEl.hidden = false; emptyEl.style.display = 'flex'; }
      if (wrapEl)  wrapEl.hidden = true;
      return;
    }
    if (emptyEl) { emptyEl.hidden = true; emptyEl.style.display = 'none'; }
    if (wrapEl)  wrapEl.hidden = false;

    let initialSlide = 0;
    if (startCharacterId && s.sortOrder !== 'random') {
      const idx = characters.findIndex(c => c.id === startCharacterId);
      if (idx >= 0) initialSlide = idx;
    }

    currentIndex = initialSlide;
    buildSlides(characters);
    initSwiper(initialSlide);
    updatePosition();
    TTS.preloadAround(s.voiceURI ?? 'samantha', characters.map(c => c.id), currentIndex);
  }

  function show() { document.getElementById('swiper-view').hidden = false; }

  function hide() {
    document.getElementById('swiper-view').hidden = true;
    if (isPlaying) {
      isPlaying = false; stopRaf(false); updatePlayButton();
      if (progressEl) progressEl.style.width = '0%';
      elapsedMs = 0;
    }
  }

  return { init, rebuild, show, hide };
})();
