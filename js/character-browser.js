/**
 * Character Browser — slide-out panel for browsing and searching characters alphabetically.
 */
const CharacterBrowser = (() => {
  const IMAGE_BASE = 'public/images';
  let onSelectCharacter = null;

  function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function open() {
    const panel = document.getElementById('browser-panel');
    const overlay = document.getElementById('browser-overlay');
    overlay.hidden = false;
    requestAnimationFrame(() => panel.classList.add('open'));
    document.getElementById('browser-search').value = '';
    renderList('');
    setTimeout(() => document.getElementById('browser-search').focus(), 300);
  }

  function close() {
    const panel = document.getElementById('browser-panel');
    const overlay = document.getElementById('browser-overlay');
    panel.classList.remove('open');
    setTimeout(() => { overlay.hidden = true; }, 260);
  }

  function getCharacters() {
    const s = Settings.get();
    return Characters.sort(Characters.getFiltered(s.movieFilter), 'alphabetical');
  }

  function renderList(query) {
    const listEl   = document.getElementById('browser-list');
    const chars    = getCharacters();
    const q        = query.trim().toLowerCase();
    const filtered = q ? chars.filter(c => c.name.toLowerCase().includes(q)) : chars;

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="browser-empty">No characters found</div>';
      return;
    }

    const groups = [];
    let currentLetter = '';
    for (const char of filtered) {
      const letter = (char.name[0] ?? '#').toUpperCase();
      if (letter !== currentLetter) { currentLetter = letter; groups.push({ letter, chars: [] }); }
      groups[groups.length - 1].chars.push(char);
    }

    let html = '';
    for (const group of groups) {
      html += `<div class="letter-separator">${esc(group.letter)}</div>`;
      for (const char of group.chars) {
        html += `<button class="character-row" data-id="${esc(char.id)}">
          <img class="mini-icon" src="${IMAGE_BASE}/${esc(char.id)}.webp" alt="" loading="lazy">
          <span class="character-name">${esc(char.name)}</span>
        </button>`;
      }
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.character-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        close();
        onSelectCharacter?.(id);
      });
    });
  }

  function init(callbacks) {
    onSelectCharacter = callbacks?.onSelectCharacter;
    document.getElementById('btn-browser-close').addEventListener('click', close);
    document.getElementById('browser-overlay').addEventListener('click', close);
    document.getElementById('browser-search').addEventListener('input', e => renderList(e.target.value));
    Settings.subscribe(() => {
      if (document.getElementById('browser-panel').classList.contains('open')) {
        renderList(document.getElementById('browser-search').value);
      }
    });
  }

  return { init, open, close };
})();
