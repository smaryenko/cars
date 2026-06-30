/**
 * Settings store — persists to localStorage, notifies listeners on change.
 */
const Settings = (() => {
  const STORAGE_KEY = 'cars-swiper-settings';

  const VALID_VOICES        = ['samantha', 'daniel', 'fred'];
  const VALID_SORT_ORDERS   = ['alphabetical', 'random'];
  const VALID_MOVIE_FILTERS = ['all', 'cars1', 'cars2', 'cars3'];
  const VALID_THEME_MODES   = ['dark', 'light', 'system'];

  const DEFAULT = {
    volume: 1.0, voiceURI: 'samantha', autoSwipeEnabled: false,
    autoSwipeTimeout: 3, sortOrder: 'alphabetical', movieFilter: 'all', themeMode: 'system',
  };

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function isValid(obj) {
    if (typeof obj !== 'object' || obj === null) return false;
    if (typeof obj.volume !== 'number' || obj.volume < 0 || obj.volume > 1) return false;
    if (obj.voiceURI !== null && typeof obj.voiceURI !== 'string') return false;
    if (typeof obj.voiceURI === 'string' && !VALID_VOICES.includes(obj.voiceURI)) return false;
    if (typeof obj.autoSwipeEnabled !== 'boolean') return false;
    if (typeof obj.autoSwipeTimeout !== 'number' || obj.autoSwipeTimeout < 1 || obj.autoSwipeTimeout > 10) return false;
    if (!VALID_SORT_ORDERS.includes(obj.sortOrder))    return false;
    if (!VALID_MOVIE_FILTERS.includes(obj.movieFilter)) return false;
    if (!VALID_THEME_MODES.includes(obj.themeMode))    return false;
    return true;
  }

  function get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT };
      const parsed = JSON.parse(raw);
      return isValid(parsed) ? parsed : { ...DEFAULT };
    } catch { return { ...DEFAULT }; }
  }

  const listeners = new Set();

  function update(partial) {
    const merged = { ...get(), ...partial };
    merged.volume           = clamp(merged.volume, 0, 1);
    merged.autoSwipeTimeout = clamp(merged.autoSwipeTimeout, 1, 10);
    merged.autoSwipeTimeout = Math.round(merged.autoSwipeTimeout * 2) / 2;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    listeners.forEach(fn => fn(merged));
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  return { get, update, subscribe, DEFAULT };
})();
