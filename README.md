# YapYapan_JAZZ_engine

Inspired by Conway's Game of Life, where every living cell is a word, pulled live from
whatever is typed into the field at the top of the page. Cells that are
about to die (per standard Life rules) glitch — bleeding characters from a
neighboring word if they're in contact with a different one, or falling
back to generic corruption symbols if they're dying in isolation. Typing
also triggers a drum hit per keystroke, with velocity driven by how fast
you're typing.

## Structure

```
textual-automaton/
├── index.html          — page shell, loads p5.js from CDN + the files below
├── css/
│   └── style.css       — page layout and the word-input box styling
├── js/
│   ├── sketch.js        — the Life simulation: grid, rules, glitch,
│   │                      font-size jitter, highlight system, live word input
│   └── audio.js         — keyboard drum trigger, fully independent of
│                           sketch.js (see "Sound" below)
└── assets/
    └── audio/
        ├── README.md    — exact filenames audio.js expects
        ├── kick.wav      \
        ├── snare.wav      \
        ├── hihat-closed.wav > your own drum samples go here
        ├── hihat-open.wav  /
        ├── tom.wav        /
        └── crash.wav     /
```

## Running locally

Because this loads `js/sketch.js` and `css/style.css` as separate files
(rather than inline), opening `index.html` directly via `file://` will be
blocked by the browser's CORS policy in some browsers. Serve it locally
instead:

```bash
# from inside the textual-automaton/ folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

or with Node:

```bash
npx serve .
```

## Deploying

This is a fully static site — no build step, no dependencies beyond the
p5.js CDN script already linked in `index.html`. Any static host works:

- **Netlify / Vercel**: drag-and-drop the `textual-automaton/` folder, or
  connect a git repo containing it. No build command needed.
- **GitHub Pages**: push this folder to a repo, enable Pages on the
  branch/folder in repo settings.
- **Any web server** (nginx, Apache, S3 static hosting, etc.): just copy
  the three files/folders up — `index.html`, `css/`, `js/`.

## Tuning

All the tunable parameters live at the top of `js/sketch.js` in the
`params` object — grid seed, font-size seed, highlight seed, cell size,
density, simulation speed, glitch intensity, font jitter amount, highlight
chance, and the three-color palette (`[word color, glitch color,
background color]`). Each is commented inline.

The default phrase in `index.html`'s input value attribute can also be
changed directly — whatever's there on page load becomes the initial word
source.

## Sound

`js/audio.js` is completely independent of `js/sketch.js` — it listens to
the same `#word-input` field, but neither file knows the other exists.
Debugging or changing one never risks breaking the other.

**How it works**: pure Web Audio API (no external library). Each of the six
drum voices can have 1–4 sample variations, all decoded on page load. Each
keystroke maps deterministically to a voice via `KEY_ZONES` — vowels
trigger the kick, common consonants the snare, remaining letters the
closed hihat, rare letters (q/x/z/j) and the spacebar trigger the crash.
When a voice has multiple variations, they're cycled round-robin (in
order, wrapping around) rather than picked randomly — this guarantees the
same variation never plays twice in a row, which pure randomness with
only 2–4 options can't promise. Every hit also gets a small random
pitch/gain nudge on top, so even a single-variation voice doesn't sound
identically robotic. Velocity is derived from typing speed — the gap
between consecutive keystrokes maps to how loud the hit is, so fast typing
reads as louder/more energetic and
slow typing as softer.

**Before this works, you need to add your own samples** — see
`assets/audio/README.md` for the exact filenames expected. Until those
files exist, the page will run fine visually; drum hits just fail silently
(logged as a warning in the browser console) rather than breaking anything.

**Autoplay note**: the `AudioContext` starts in a browser-enforced
`suspended` state and is resumed on the very first keystroke — this is
required by browser policy and isn't a bug if you notice the very first
keystroke on page load is silent while the context wakes up.

Everything tunable in this system lives at the top of `js/audio.js`:
`KIT_FILES` (sample paths), `KEY_ZONES` (which letters trigger which
drum), and the jitter/velocity ranges inline in `playHit()` and
`handleDrumKeydown()`.

