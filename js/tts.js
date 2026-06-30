/**
 * TTS service — uses pre-generated .m4a files.
 */
const TTS = (() => {
  const VOICES = ['samantha', 'daniel', 'fred'];
  const AUDIO_BASE = 'public/audio';

  const cache = new Map();

  function resolveVoice(voiceId) {
    return VOICES.includes(voiceId) ? voiceId : 'samantha';
  }

  function audioPath(voice, characterId) {
    return `${AUDIO_BASE}/${voice}/${characterId}.m4a`;
  }

  function preloadOne(voice, characterId) {
    const key = `${voice}/${characterId}`;
    if (cache.has(key)) return;
    const audio = new Audio(audioPath(voice, characterId));
    audio.preload = 'auto';
    cache.set(key, audio);
  }

  function preloadAround(voiceId, characterIds, currentIndex) {
    const voice = resolveVoice(voiceId);
    for (let i = 0; i < 4; i++) {
      const idx = (currentIndex + i) % characterIds.length;
      if (characterIds[idx]) preloadOne(voice, characterIds[idx]);
    }
  }

  function speak(characterId, voiceId, volume) {
    const voice  = resolveVoice(voiceId);
    const key    = `${voice}/${characterId}`;
    const cached = cache.get(key);
    const audio  = cached ?? new Audio(audioPath(voice, characterId));
    audio.volume = Math.max(0, Math.min(1, volume));
    if (cached) audio.currentTime = 0;
    audio.play().catch(() => {});
    if (!cached) cache.set(key, audio);
  }

  function playQuizFeedback(type, voiceId, volume) {
    const voice = resolveVoice(voiceId);
    const index = Math.floor(Math.random() * 5);
    const audio = new Audio(`${AUDIO_BASE}/${voice}/quiz-${type}-${index}.m4a`);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(() => {});
  }

  return { speak, preloadAround, playQuizFeedback };
})();
