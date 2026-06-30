/**
 * Settings Panel — slide-out panel for all app configuration options.
 */
const SettingsPanel = (() => {
  let onClose = null;

  function open() {
    const s = Settings.get();
    document.getElementById('voice-select').value        = s.voiceURI ?? 'samantha';
    document.getElementById('timeout-slider').value      = s.autoSwipeTimeout;
    document.getElementById('timeout-value').textContent = s.autoSwipeTimeout;
    document.getElementById('sort-select').value         = s.sortOrder;
    document.getElementById('movie-select').value        = s.movieFilter;
    document.getElementById('theme-select').value        = s.themeMode;
    document.getElementById('settings-overlay').hidden = false;
    requestAnimationFrame(() => document.getElementById('settings-panel').classList.add('open'));
  }

  function close() {
    document.getElementById('settings-panel').classList.remove('open');
    setTimeout(() => { document.getElementById('settings-overlay').hidden = true; }, 260);
    onClose?.();
  }

  function init(callbacks) {
    onClose = callbacks?.onClose;
    document.getElementById('btn-settings-close').addEventListener('click', close);
    document.getElementById('settings-overlay').addEventListener('click', close);
    document.getElementById('voice-select').addEventListener('change', e =>
      Settings.update({ voiceURI: e.target.value }));
    const timeoutSlider = document.getElementById('timeout-slider');
    const timeoutValue  = document.getElementById('timeout-value');
    timeoutSlider.addEventListener('input', () => {
      const v = parseFloat(timeoutSlider.value);
      timeoutValue.textContent = v;
      Settings.update({ autoSwipeTimeout: v });
    });
    document.getElementById('sort-select').addEventListener('change', e =>
      Settings.update({ sortOrder: e.target.value }));
    document.getElementById('movie-select').addEventListener('change', e =>
      Settings.update({ movieFilter: e.target.value }));
    document.getElementById('theme-select').addEventListener('change', e =>
      Settings.update({ themeMode: e.target.value }));
  }

  return { init, open, close };
})();
