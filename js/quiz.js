/**
 * Quiz View — shows a character image and four name options.
 */
const QuizView = (() => {
  const IMAGE_BASE = 'public/images';

  let quizItems     = [];
  let currentIdx    = 0;
  let wrongIds      = new Set();
  let correctId     = null;
  let transitioning = false;
  let onBack        = null;
  let onSettingsClick = null;

  function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function pickRandom(arr, count, exclude) {
    const pool = exclude ? arr.filter(c => c !== exclude) : [...arr];
    const result = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return result;
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function generateQuiz(characters) {
    if (characters.length < 4) return [];
    return shuffle(characters).map(correct => ({
      correct,
      options: shuffle([correct, ...pickRandom(characters, 3, correct)]),
    }));
  }

  function getCharacters() {
    const s = Settings.get();
    return Characters.sort(Characters.getFiltered(s.movieFilter), 'random');
  }

  function renderQuestion() {
    const quiz    = quizItems[currentIdx];
    const emptyEl = document.getElementById('quiz-empty');
    const promptEl = document.querySelector('.quiz-prompt');
    const gridEl  = document.getElementById('quiz-grid');
    const titleEl = document.getElementById('quiz-title');

    if (!quiz) {
      if (emptyEl)  emptyEl.hidden  = false;
      if (promptEl) promptEl.hidden = true;
      if (gridEl)   gridEl.hidden   = true;
      if (titleEl)  titleEl.textContent = 'Quiz';
      return;
    }
    if (emptyEl)  emptyEl.hidden  = true;
    if (promptEl) promptEl.hidden = false;
    if (gridEl)   gridEl.hidden   = false;
    if (titleEl)  titleEl.textContent = 'Who is this?';

    document.getElementById('quiz-image').src = `${IMAGE_BASE}/${quiz.correct.id}.webp`;

    gridEl.innerHTML = quiz.options.map(opt => {
      const isCorrect = correctId === opt.id;
      const isWrong   = wrongIds.has(opt.id);
      const cls = ['option-card', isCorrect ? 'correct' : '', isWrong ? 'wrong' : ''].filter(Boolean).join(' ');
      const icon = isCorrect ? '<span class="option-overlay-icon">✓</span>'
                 : isWrong   ? '<span class="option-overlay-icon">✗</span>' : '';
      return `<button class="${cls}" data-id="${esc(opt.id)}" ${(transitioning || isWrong) ? 'disabled' : ''}>
                <span>${esc(opt.name)}</span>${icon}
              </button>`;
    }).join('');

    gridEl.querySelectorAll('.option-card').forEach(btn =>
      btn.addEventListener('click', () => handleOptionClick(btn.getAttribute('data-id')))
    );
  }

  function handleOptionClick(selectedId) {
    if (transitioning) return;
    const quiz = quizItems[currentIdx];
    if (!quiz || correctId || wrongIds.has(selectedId)) return;

    const s = Settings.get();
    if (selectedId === quiz.correct.id) {
      correctId = selectedId;
      TTS.playQuizFeedback('correct', s.voiceURI ?? 'samantha', s.volume);
      renderQuestion();
      transitioning = true;
      setTimeout(() => {
        correctId = null; wrongIds = new Set(); transitioning = false;
        if (currentIdx + 1 < quizItems.length) { currentIdx++; }
        else { quizItems = generateQuiz(getCharacters()); currentIdx = 0; }
        renderQuestion();
      }, 1500);
    } else {
      wrongIds.add(selectedId);
      TTS.playQuizFeedback('wrong', s.voiceURI ?? 'samantha', s.volume);
      renderQuestion();
    }
  }

  function init(callbacks) {
    onBack          = callbacks?.onBack;
    onSettingsClick = callbacks?.onSettingsClick;
    document.getElementById('btn-quiz-back').addEventListener('click', () => onBack?.());
    document.getElementById('btn-quiz-settings').addEventListener('click', () => onSettingsClick?.());
    document.getElementById('btn-quiz-replay').addEventListener('click', () => {
      const quiz = quizItems[currentIdx];
      if (!quiz) return;
      const s = Settings.get();
      TTS.speak(quiz.correct.id, s.voiceURI ?? 'samantha', s.volume);
    });
    Settings.subscribe(() => {
      if (!document.getElementById('quiz-view').hidden) reset();
    });
  }

  function reset() {
    correctId = null; wrongIds = new Set(); transitioning = false; currentIdx = 0;
    quizItems = generateQuiz(getCharacters());
    renderQuestion();
  }

  function show() { document.getElementById('quiz-view').hidden = false; reset(); }
  function hide() { document.getElementById('quiz-view').hidden = true; }

  return { init, show, hide };
})();
