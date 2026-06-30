/**
 * App entry point — wires all modules together, handles view switching.
 */

const Characters = (() => {
  function getFiltered(filter) {
    if (filter !== 'all') return CHARACTERS_DATA.filter(c => c.movie === filter);
    const seen = new Set(), result = [];
    for (const c of CHARACTERS_DATA) { if (!seen.has(c.id)) { seen.add(c.id); result.push(c); } }
    return result;
  }

  function sort(characters, order) {
    const copy = [...characters];
    if (order === 'alphabetical') { copy.sort((a, b) => a.name.localeCompare(b.name)); return copy; }
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  return { getFiltered, sort };
})();

(function App() {
  function applyTheme(themeMode) {
    if (themeMode === 'dark' || themeMode === 'light') {
      document.documentElement.setAttribute('data-theme', themeMode);
      return;
    }
    const mq    = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = isDark => document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    apply(mq.matches);
    mq.addEventListener('change', e => { if (Settings.get().themeMode === 'system') apply(e.matches); });
  }

  function showSwiper(startCharacterId) {
    QuizView.hide();
    SwiperView.show();
    SwiperView.rebuild(startCharacterId);
  }

  function init() {
    applyTheme(Settings.get().themeMode);
    Settings.subscribe(s => applyTheme(s.themeMode));

    SwiperView.init({
      onSettingsClick: () => SettingsPanel.open(),
      onBrowseClick:   () => CharacterBrowser.open(),
      onQuizClick:     () => { SwiperView.hide(); QuizView.show(); },
    });
    SettingsPanel.init({});
    CharacterBrowser.init({ onSelectCharacter: id => showSwiper(id) });
    QuizView.init({
      onBack:          () => showSwiper(null),
      onSettingsClick: () => SettingsPanel.open(),
    });

    showSwiper(null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
