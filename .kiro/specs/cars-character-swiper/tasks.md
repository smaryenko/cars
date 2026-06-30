# Implementation Plan: Cars Character Swiper

## Overview

Plain HTML/CSS/JavaScript rewrite. No build step, no framework, no server. Open `index.html` directly in a browser.

## Completed Tasks

- [x] 1. Define module structure and script loading order
  - IIFE pattern for each module (Settings, TTS, SwiperView, SettingsPanel, CharacterBrowser, QuizView, App)
  - Plain `<script>` tags in dependency order — no ES module imports

- [x] 2. Generate character data file
  - `generate.js` converts `public/characters.json` → `js/characters.js`
  - Output: `const CHARACTERS_DATA = [...]` (plain JS, no fetch needed)
  - Run: `node generate.js` from project root

- [x] 3. Implement Settings store (`js/settings.js`)
  - localStorage persistence with validation and fallback to defaults
  - Pub/sub listener pattern (`Settings.subscribe(fn)`)

- [x] 4. Implement TTS service (`js/tts.js`)
  - HTMLAudio-based playback using `public/audio/<voice>/<id>.m4a`
  - Audio element cache by `voice/id` key
  - Preloads current + next 3 characters only

- [x] 5. Implement Swiper View (`js/swiper-view.js`)
  - Swiper web component (`<swiper-container>`) with loop mode
  - Fresh element replacement on each `rebuild()` to avoid re-init issues
  - NaN guard on `swiperslidechange` for Swiper loop initialization events
  - Custom rAF autoplay timer with pause/resume from exact position
  - Progress bar synchronized to rAF timer
  - Volume popup control
  - Keyboard shortcuts (Space, ←, →)
  - Selective settings subscription (rebuilds only on movieFilter/sortOrder changes)

- [x] 6. Implement Settings Panel (`js/settings-panel.js`)
  - Slide-out overlay from right edge
  - Voice, timeout, sort order, movie filter, theme controls
  - Syncs control values to current settings on open

- [x] 7. Implement Character Browser (`js/character-browser.js`)
  - Slide-out overlay, alphabetical grouping with sticky letter separators
  - Case-insensitive search filter
  - Mini icon (36×36px) per character row
  - Auto-focuses search input on open

- [x] 8. Implement Quiz Mode (`js/quiz.js`)
  - 2×2 grid of name options (1 correct, 3 random wrong)
  - Correct: green highlight + ✓ + feedback audio + 1.5s auto-advance
  - Wrong: red highlight + ✗ + feedback audio + option disabled
  - 🔊 replay button (no auto-play)
  - Respects Movie_Filter; requires ≥ 4 characters

- [x] 9. Implement App coordinator (`js/app.js`)
  - `Characters` module: `getFiltered(filter)`, `sort(characters, order)`
  - App IIFE: view switching (swiper ↔ quiz), theme application, module wiring

- [x] 10. HTML and CSS
  - `index.html`: all view markup, settings panel, browser panel
  - `css/styles.css`: merged styles with CSS custom property theming

- [x] 11. Cleanup
  - Removed: `src/`, `dist/`, `node_modules/`, `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `vanilla/`
  - Kept: `scripts/` (TypeScript utility scripts), `public/` (assets), `.kiro/`

## Bug Fixes Applied

- **NaN / 707 position indicator**: Swiper fires `swiperslidechange` during loop initialization before `realIndex` is valid. Added `if (!Number.isFinite(realIdx)) return` guard in the slide change handler.
- **Empty state visible behind swiper**: `.empty-state` needed explicit `style="display:none"` in addition to the `hidden` attribute to override flex layout.
- **Autoplay progress not preserved on pause/resume**: `stopRaf(saveProgress)` now saves elapsed time using `rafSavedElapsed + (performance.now() - rafStartTime)` when `saveProgress = true`.
- **Swiper re-initialization on settings change**: `rebuild()` now destroys and replaces the `<swiper-container>` element entirely rather than mutating the existing one.
- **Unnecessary rebuilds on voice/volume changes**: Settings subscriber in `swiper-view.js` compares against `lastMovieFilter` and `lastSortOrder` and only calls `rebuild()` when those change.
