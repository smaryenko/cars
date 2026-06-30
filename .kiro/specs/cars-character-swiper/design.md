# Design Document: Cars Character Swiper

## Overview

Cars Character Swiper is a plain **HTML/CSS/JavaScript** app — no framework, no build step, no server required. It presents a card-based carousel of Disney/Pixar Cars movie characters that children can swipe through. Each card shows a character image and name, and the app reads the name aloud using pre-generated audio files (M4A format) with three bundled voices.

Open `index.html` directly in a browser. All assets are served via relative paths (`public/images/`, `public/audio/`) that work on the `file://` protocol.

## Architecture

### File Structure

```
index.html              ← entry point, loads Swiper CDN + all scripts
generate.js             ← one-time script: public/characters.json → js/characters.js
css/styles.css          ← all styles (merged from original CSS modules)
js/
  characters.js         ← CHARACTERS_DATA array (auto-generated)
  settings.js           ← Settings IIFE: localStorage store + pub/sub
  tts.js                ← TTS IIFE: HTMLAudio-based playback + cache
  swiper-view.js        ← SwiperView IIFE: main card carousel UI
  settings-panel.js     ← SettingsPanel IIFE: slide-out settings
  character-browser.js  ← CharacterBrowser IIFE: browse + search panel
  quiz.js               ← QuizView IIFE: quiz mode
  app.js                ← Characters module + App coordinator
public/
  characters.json       ← character manifest (source of truth)
  images/<id>.webp      ← character images
  audio/<voice>/<id>.m4a ← pre-generated name audio
scripts/                ← TypeScript utility scripts (scraper, audio gen, etc.)
```

### Module Pattern

Each JS file defines one global IIFE that exposes a public API:

```js
const ModuleName = (() => {
  // private state
  function privateHelper() { ... }
  function publicMethod() { ... }
  return { publicMethod };
})();
```

Scripts are loaded in dependency order via plain `<script>` tags — no ES module imports, so `file://` works without restrictions.

### Script Loading Order

```html
<script src="js/characters.js"></script>     <!-- CHARACTERS_DATA array -->
<script src="js/settings.js"></script>        <!-- Settings -->
<script src="js/tts.js"></script>             <!-- TTS -->
<script src="js/swiper-view.js"></script>     <!-- SwiperView -->
<script src="js/settings-panel.js"></script>  <!-- SettingsPanel -->
<script src="js/character-browser.js"></script> <!-- CharacterBrowser -->
<script src="js/quiz.js"></script>            <!-- QuizView -->
<script src="js/app.js"></script>             <!-- Characters + App -->
```

`Characters` (filtering/sorting logic) is defined at the top of `app.js` before the App IIFE runs. All modules that call `Characters.getFiltered()` or `Characters.sort()` do so only at runtime (inside callbacks), never at parse time, so the load order is safe.

## Key Design Decisions

### No Framework

React was removed in favor of direct DOM manipulation. Each module manages its own DOM subtree:
- View switching: `element.hidden = true/false`
- Dynamic content: `innerHTML` with escaped strings or `createElement` + `appendChild`
- State → UI updates: explicit function calls after state changes

### Swiper Web Component

The app uses Swiper's web component bundle (`swiper-element-bundle`) loaded from CDN. This is the same approach as the original React app — `<swiper-container>` and `<swiper-slide>` are custom elements that Swiper registers globally. The `.swiper` property on the container gives access to the Swiper instance API.

On each `rebuild()`, the old `<swiper-container>` is destroyed and replaced with a fresh element to cleanly reinitialize with new slides. This avoids the complexity of re-initializing an already-initialized Swiper instance.

**NaN guard**: Swiper fires `swiperslidechange` internally during loop initialization before `realIndex` is valid. All slide change handlers guard against this:
```js
const realIdx = swiper.realIndex;
if (!Number.isFinite(realIdx)) return;
```

### Custom Autoplay Timer

Auto-swipe uses a `requestAnimationFrame` loop instead of Swiper's built-in autoplay. This provides:
- A synchronized progress bar that shows exact time remaining
- True pause/resume from the exact position (Swiper's autoplay resets its timer on resume)
- Clean integration with the play/stop button state

State tracked at module level in `swiper-view.js`:
- `elapsedMs` — milliseconds elapsed in the current slide interval
- `rafStartTime` — `performance.now()` when the current rAF segment started
- `rafSavedElapsed` — value of `elapsedMs` captured when `startRaf()` was called

On pause: `stopRaf(true)` saves `elapsedMs = rafSavedElapsed + (performance.now() - rafStartTime)`.  
On resume: `startRaf()` picks up from the saved `elapsedMs`.  
On slide change: `elapsedMs = 0` then `startRaf()` if playing.

### Settings Store

`js/settings.js` is a direct port of the original `settingsStore.ts`:
- Reads/writes `localStorage["cars-swiper-settings"]`
- Validates stored values; falls back to defaults on invalid data
- Pub/sub listener pattern: `Settings.subscribe(fn)` returns an unsubscribe function
- Modules subscribe to relevant changes and rebuild only when needed (e.g., `swiper-view.js` only rebuilds on `movieFilter` or `sortOrder` changes, not on voice/volume/theme changes)

### Theming

CSS custom properties (`--color-bg`, `--color-surface`, etc.) are scoped to `[data-theme="dark"]` and `[data-theme="light"]` on `<html>`. `app.js` sets the attribute on init and subscribes to settings changes. For "System Default", it also listens to `window.matchMedia("(prefers-color-scheme: dark)").change`.

### Character Data

`public/characters.json` is the source of truth (produced by `scripts/scraper.ts`). Running `node generate.js` converts it to `js/characters.js`:

```js
const CHARACTERS_DATA = [
  { "id": "lightning-mcqueen", "name": "Lightning McQueen", "movie": "cars1" },
  ...
];
```

This is a plain script tag — no fetch, no JSON.parse, works on `file://`. The `Characters` module in `app.js` provides `getFiltered(filter)` and `sort(characters, order)` functions over this array.

### Quiz Mode

Quiz mode presents a character image and asks the user to pick the correct name from 4 options (1 correct, 3 random wrong). Key behaviors:
- No auto-play of audio; 🔊 button plays on demand
- Correct: green + ✓ + feedback audio + 1.5s delay → next item
- Wrong: red + ✗ + feedback audio → stays on item; wrong option disabled
- Feedback audio: `public/audio/<voice>/quiz-correct-N.m4a` and `quiz-wrong-N.m4a` (N = 0–4)
- Respects Movie_Filter; requires ≥ 4 characters; regenerates when exhausted

### Audio Paths

All audio is at `public/audio/<voice>/<id>.m4a` (relative to `index.html`). The `TTS` module caches `HTMLAudioElement` instances by `voice/id` key. Preloading covers current + next 3 characters only.

## Character Data Scope

- **Cars 1** (~293 entries), **Cars 2** (~249 entries), **Cars 3** (~237 entries)
- **Total**: ~779 entries, ~707 unique characters after deduplication by `id`
- Deduplication: first occurrence of each `id` wins when filter is "All"

## Utility Scripts

The `scripts/` folder retains the original TypeScript utility scripts:

| Script | Purpose |
|---|---|
| `scraper.ts` | Scrapes character names/images from Pixar Cars Fandom wiki via MediaWiki API |
| `generate-audio.ts` | Generates character name audio files using macOS TTS |
| `generate-quiz-sounds.ts` | Generates quiz feedback audio (correct/wrong) |
| `generate-alphabet-pptx.ts` | Generates a PowerPoint alphabet reference |

These require Node.js and TypeScript tooling to run. They operate independently of the app runtime.
