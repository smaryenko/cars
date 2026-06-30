# Requirements Document

## Introduction

Cars Character Swiper is a plain HTML/CSS/JavaScript app that allows children to browse through Cars movie characters by swiping through cards. Each card displays a character image and name, and the app reads the character name aloud using pre-generated audio files. The app requires no build step, no server, and no framework — it runs by opening `index.html` directly in a browser. It supports manual and automatic swiping, works offline (with a local Swiper bundle), and character data is embedded as a plain JS array. A slide-out settings panel allows users to configure voice, volume, and auto-swipe behavior. A controller bar provides navigation buttons, play/stop auto-swipe control with a progress bar, and a slide position indicator. A character browser panel enables searching and jumping to specific characters. A quiz mode tests character name recognition. Keyboard shortcuts support common actions.

## Glossary

- **App**: The Cars Character Swiper HTML/CSS/JS app
- **Card**: A visual element displaying a single character's image and name
- **Character_Data**: The bundled set of character images and character names embedded within the App as a plain JS array (`CHARACTERS_DATA` in `js/characters.js`), where each character is tagged with the source movie (Cars 1, Cars 2, or Cars 3)
- **Character_Image**: The image element within a Card that displays the character's visual representation
- **Swiper**: The card carousel component (Swiper web component) that enables navigation between Cards via swipe gestures or automatic advancement
- **TTS_Engine**: The text-to-speech engine responsible for reading character names aloud using pre-generated audio files (M4A format) in `public/audio/<voice>/<id>.m4a`, with three available voices: Samantha (female), Daniel (male), and Fred (novelty)
- **Character_Scraper**: The script (`scripts/scraper.ts`) that uses the Fandom MediaWiki API to extract character names and images, downloads the images, converts them to WebP, and stores them in `public/`
- **Settings_Panel**: The slide-out side panel where users adjust voice, volume, auto-swipe timeout, character sort order, Movie_Filter selection, and Theme_Mode
- **Character_Browser**: A slide-out side panel with an alphabetical character list, search functionality, mini icons, and letter separators for navigating to a specific character
- **Controller_Bar**: A navigation bar rendered below the Swiper containing slide navigation buttons, the Play_Button, volume control, and a Slide_Position_Indicator
- **Play_Button**: A toggle control (▶/⏹) in the Controller_Bar that starts or stops Auto_Swipe
- **Slide_Position_Indicator**: A text label within the Controller_Bar that displays "current / total" (e.g., "5 / 707")
- **Movie_Filter**: Filters displayed characters by movie: "All", "Cars 1", "Cars 2", "Cars 3"
- **Auto_Swipe**: Automatic card advancement after a configurable timeout, driven by a `requestAnimationFrame` loop (not Swiper's built-in autoplay)
- **Sort_Order**: "Alphabetical" (A-Z) or "Random" (Fisher-Yates shuffle)
- **Theme_Mode**: "Dark", "Light", or "System Default" (follows `prefers-color-scheme`)
- **Keyboard_Shortcuts**: Spacebar = play/stop, Left Arrow = previous slide, Right Arrow = next slide

## Technical Approach

- **No build step**: pure HTML, CSS, and JS loaded via `<script>` tags in dependency order
- **No framework**: no React, no Vue, no bundler — plain global IIFE modules
- **No server required**: all asset paths are relative; works on `file://` protocol
- **Swiper**: loaded from CDN (`swiper-element-bundle`) as web components (`<swiper-container>`, `<swiper-slide>`)
- **Character data**: `public/characters.json` → converted to `js/characters.js` by running `node generate.js`
- **Settings**: persisted to `localStorage` via `js/settings.js`
- **Audio**: relative paths `public/audio/<voice>/<id>.m4a`
- **Images**: relative paths `public/images/<id>.webp`

## Requirements

### Requirement 1: Card Layout and Fixed-Dimension Centered Images

**User Story:** As a user, I want each character card to show the character image at a consistent size with the name below it, so that the visual layout is consistent and predictable as I swipe through characters.

#### Acceptance Criteria

1. THE Card SHALL display the character image as the primary visual element occupying the upper portion of the Card
2. THE Card SHALL display the character name as a text label positioned directly below the character image, rendered at `clamp(1.25rem, 5vw, 2rem)` bold font size
3. THE Card SHALL render the Character_Image using `width: min(60vmin, 75vw)` and `height: min(60vmin, 50vh)`
4. THE Card SHALL center the Character_Image both horizontally and vertically within the Card
5. THE Character_Image SHALL use `object-fit: contain` to preserve aspect ratio
6. THE Card SHALL derive the image path from the character id as `public/images/<id>.webp`

### Requirement 2: TTS Character Name Announcement

**User Story:** As a user, I want the assistant voice to read the character name aloud after a card is displayed, so that I can hear the character's name.

#### Acceptance Criteria

1. WHEN a Card becomes active (via `swiperslidechange` + `requestAnimationFrame`), THE TTS_Engine SHALL play `public/audio/<voice>/<characterId>.m4a`
2. THE TTS_Engine SHALL guard against `NaN` realIndex values fired by Swiper during loop initialization
3. THE TTS_Engine SHALL preload audio for the current character plus the next 3 characters only
4. IF audio playback fails, THE App SHALL continue without interruption

### Requirement 3: Tap-to-Speak TTS on Character Image

**User Story:** As a user, I want to hear the character name spoken aloud when I tap on the character image.

#### Acceptance Criteria

1. WHEN the user taps the Character_Image, THE TTS_Engine SHALL play the character's audio
2. WHEN the user taps while audio is playing, THE TTS_Engine SHALL reset and replay
3. THE tap SHALL NOT trigger a slide transition (`stopPropagation`)

### Requirement 4: Manual Swipe Navigation

#### Acceptance Criteria

1. THE Swiper SHALL support left/right swipe gestures to navigate between cards
2. THE Swiper SHALL loop (wrap around) at both ends

### Requirement 5: Auto-Swipe with Play/Stop Control

#### Acceptance Criteria

1. THE Play_Button SHALL toggle autoplay (▶ / ⏹)
2. WHEN autoplay starts, THE App SHALL speak the current character and begin the rAF timer
3. WHEN autoplay stops, THE rAF timer SHALL be cancelled and the progress bar position saved
4. WHEN autoplay resumes, THE rAF timer SHALL continue from the saved position
5. THE autoplay timer SHALL be managed by a custom `requestAnimationFrame` loop, not Swiper's built-in autoplay
6. Spacebar SHALL toggle play/stop; Arrow keys SHALL navigate slides

### Requirement 6: Slider Controller Bar

#### Acceptance Criteria

1. THE Controller_Bar SHALL contain: ⏮ (go to start), ‹ (previous), play/stop button, position indicator, › (next), ⏭ (go to end), volume control
2. THE Slide_Position_Indicator SHALL display "current / total" and update on every slide change
3. THE position indicator SHALL never display NaN (guard against Swiper loop initialization events)

### Requirement 7: Settings Panel

#### Acceptance Criteria

1. THE Settings_Panel SHALL slide in from the right as an overlay
2. Settings SHALL include: voice selector, auto-swipe timeout (1–10s, 0.5s step), sort order, movie filter, theme
3. WHEN settings change, THE App SHALL apply changes immediately
4. WHEN sort order or movie filter changes, THE Swiper SHALL rebuild with new character list
5. Settings SHALL persist to `localStorage`

### Requirement 8: Character Browser Panel

#### Acceptance Criteria

1. THE Character_Browser SHALL slide in from the right as an overlay
2. THE Character_Browser SHALL always display characters in alphabetical order
3. THE Character_Browser SHALL support search (case-insensitive substring)
4. THE Character_Browser SHALL group characters by first letter with sticky separators
5. WHEN a character is selected, THE App SHALL rebuild the swiper starting at that character

### Requirement 9: Offline Support

#### Acceptance Criteria

1. THE App SHALL function without an internet connection when the Swiper CDN script is replaced with a locally bundled copy
2. All character images and audio files are served from `public/` (no external requests)
3. Character data is embedded in `js/characters.js` as a plain JS array (no fetch required)

### Requirement 10: Character Sort Order

#### Acceptance Criteria

1. "Alphabetical" SHALL sort A-Z by character name using `localeCompare`
2. "Random" SHALL shuffle using Fisher-Yates
3. DEFAULT sort order SHALL be "Alphabetical"
4. WHEN sort order changes, THE Swiper SHALL rebuild with reordered cards

### Requirement 11: Movie Filter

#### Acceptance Criteria

1. Filter options: All, Cars 1, Cars 2, Cars 3
2. "All" SHALL deduplicate by id (first occurrence wins across movies)
3. DEFAULT filter SHALL be "All"
4. WHEN filter changes, THE Swiper SHALL rebuild with filtered characters

### Requirement 12: Dark/Light Mode

#### Acceptance Criteria

1. THE App SHALL support dark and light themes via `data-theme` on `<html>`
2. "System Default" SHALL follow `prefers-color-scheme` and update dynamically
3. "Dark" and "Light" SHALL override system preference
4. Theme changes SHALL apply immediately

### Requirement 13: Autoplay Progress Bar

#### Acceptance Criteria

1. A 3px progress bar SHALL fill left-to-right over the auto-swipe timeout
2. WHEN paused, THE progress bar SHALL freeze at its current position
3. WHEN resumed, THE progress bar SHALL continue from the frozen position
4. WHEN a slide changes (manual or auto), THE progress bar SHALL reset to 0%

### Requirement 14: Quiz Mode

#### Acceptance Criteria

1. Quiz Mode shows a character image and 4 name options (1 correct, 3 random wrong)
2. Correct answer highlights green with ✓ and plays feedback audio; auto-advances after 1.5s
3. Wrong answer highlights red with ✗ and plays feedback audio; remains on same item
4. Wrong options are disabled after selection
5. THE 🔊 button SHALL play the character name audio on demand (no autoplay)
6. Quiz respects the current Movie_Filter
7. WHEN all items are exhausted, a new quiz set is generated

### Requirement 15: Character Data Generation

**User Story:** As a developer, I want a script to convert `public/characters.json` into `js/characters.js`.

#### Acceptance Criteria

1. Running `node generate.js` from the project root SHALL write `js/characters.js` containing `const CHARACTERS_DATA = [...]`
2. The generated file SHALL be a plain JS script (no ES module syntax) compatible with `<script src="...">` loading
3. The source SHALL be `public/characters.json` (the character manifest produced by the scraper)

### Requirement 16: Build-Time Character Data Extraction

**User Story:** As a developer, I want the TypeScript scraper scripts in `scripts/` to remain available for maintaining character data.

#### Acceptance Criteria

1. `scripts/scraper.ts` SHALL extract character names and images from the Pixar Cars Fandom wiki using the MediaWiki API
2. `scripts/generate-audio.ts` SHALL generate character name audio files for all three voices
3. `scripts/generate-quiz-sounds.ts` SHALL generate quiz feedback audio
4. These scripts operate independently of the app runtime and require Node.js to run
