# Cars Character Swiper

A plain HTML/CSS/JavaScript app for browsing Pixar Cars movie characters. No build step, no server required — open `index.html` directly in a browser.

## Project Structure

```
cars/
  index.html          ← open this to run the app
  generate.js         ← run once to rebuild js/characters.js from public/characters.json
  css/
    styles.css
  js/
    characters.js     ← auto-generated character data (779 entries, 707 unique)
    settings.js       ← localStorage settings store
    tts.js            ← audio playback service
    swiper-view.js    ← main swiper UI, autoplay, volume
    settings-panel.js ← settings slide-out panel
    character-browser.js ← alphabetical browse + search panel
    quiz.js           ← quiz mode
    app.js            ← app entry point, wires everything together
  public/
    characters.json   ← character manifest (source of truth)
    images/           ← character images (.webp)
    audio/            ← pre-generated name audio, 3 voices (samantha, daniel, fred)
  scripts/            ← TypeScript utility scripts (scraper, audio generation, etc.)
```

## Running the App

Double-click `index.html` or open it with any browser via `File → Open`. No installation needed.

The app loads [Swiper](https://swiperjs.com/) from a CDN, so an internet connection is required on first load. For fully offline use, download `swiper-element-bundle.min.js` locally and update the `<script>` src in `index.html`:

```html
<script src="swiper-element-bundle.min.js"></script>
```

## Regenerating Character Data

If `public/characters.json` is updated (e.g., after running the scraper), regenerate the JS data file:

```bash
node generate.js
```

This writes `js/characters.js` with all characters as a plain JS array.

## Utility Scripts

The `scripts/` folder contains TypeScript scripts for maintaining character data. These require Node.js and the project's original dev dependencies to run:

- `scripts/scraper.ts` — scrapes character names and images from the Pixar Cars Fandom wiki
- `scripts/generate-audio.ts` — generates character name audio files using macOS TTS voices
- `scripts/generate-quiz-sounds.ts` — generates correct/wrong feedback audio for quiz mode
- `scripts/generate-alphabet-pptx.ts` — generates a PowerPoint alphabet reference

## Features

- Swipe through 707 unique character cards (images + names)
- Tap a card image to hear the character name spoken aloud
- Autoplay with configurable interval (1–10s) and a progress bar
- Progress bar freezes on pause and resumes from the same position
- Three voices: Samantha (female), Daniel (male), Fred (novelty)
- Alphabetical or random sort order
- Filter by movie: All, Cars 1, Cars 2, Cars 3
- Browse and search all characters alphabetically with jump-to
- Quiz mode: match character images to names
- Dark / Light / System theme
- Settings persisted to localStorage
- Keyboard shortcuts: Space (play/stop), ← → (navigate)
