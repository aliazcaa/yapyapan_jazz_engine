// ═══════════════════════════════════════════════════════════════
// KEYBOARD DRUM TRIGGER — instant, free-typing-rhythm percussion
// Pure Web Audio API (no Tone.js) — decoded sample playback with a
// thin layer of per-hit pitch/gain jitter so nothing repeats identically.
// Each voice can have up to 4 sample variations, cycled round-robin so
// the same variation never plays twice in a row.
//
// Fully decoupled from sketch.js: this file only listens to the same
// #word-input field the p5 sketch already reads from. Neither file
// knows the other exists. If something breaks in the drums, it's a
// problem in THIS file, never in the Life simulation, and vice versa.
// ═══════════════════════════════════════════════════════════════

// ---- 1. Your drum kit — each voice can have 1–4 sample variations.
// Round-robin cycling (below) steps through them in order per trigger,
// so you get even coverage and never hear the same variation twice in a
// row — more reliable than pure random with only a few options each.
const KIT_FILES = {
    kick:        ['assets/audio/00_Kick_04_Big.wav', 'assets/audio/00_Kick_05_Big.wav'],
    snare:       ['assets/audio/01_Snare_20_G.wav', 'assets/audio/01_Snare_21_G.wav', 'assets/audio/01_Snare_22_G.wav', 'assets/audio/02_Snare_Flam_01_E.wav', 'assets/audio/02_Snare_Roll_01_Short.wav'],
    rim:         ['assets/audio/03_Misc_08_Rim.wav'],
    hihatClosed: ['assets/audio/04_Closed_Hat_01_Clean.wav', 'assets/audio/04_Closed_Hat_09_Hard.wav', 'assets/audio/04_Closed_Hat_10_Hard.wav', 'assets/audio/04_Closed_Hat_13_Pedal.wav', 'assets/audio/04_Closed_Hat_14_Pedal.wav'],
    hihatOpen:   ['assets/audio/05_Open_Hat_01_Full_Open.wav', 'assets/audio/05_Open_Hat_05_Hard.wav', 'assets/audio/05_Open_Hat_16_Open_and_Close.wav', 'assets/audio/05_Open_Hat_17_Roll_and_Close.wav'],
    tom:         ['assets/audio/08_Tom_02_Low_C.wav', 'assets/audio/08_Tom_06_Low_E.wav', 'assets/audio/08_Tom_19_Low_Flam_A#.wav', 'assets/audio/09_Tom_07_Medium_A.wav', 'assets/audio/09_Tom_08_Medium_A.wav', 'assets/audio/09_Tom_21_Medium_Flam_B.wav'],
    ride:        ['assets/audio/07_Ride_01.wav', 'assets/audio/07_Ride_02.wav', 'assets/audio/07_Ride_03.wav', 'assets/audio/07_Ride_04.wav', 'assets/audio/07_Ride_05.wav', 'assets/audio/07_Ride_07.wav', 'assets/audio/07_Ride_08.wav'],
    crash:       ['assets/audio/06_Crash_02.wav', 'assets/audio/06_Crash_03.wav', 'assets/audio/06_Crash_11.wav', 'assets/audio/06_Crash_12.wav']
};

// ---- 2. Key → drum-voice zones (deterministic, not random) ----
// Same letter always triggers the same voice, so a repeated word produces
// a recognizably similar rhythm rather than feeling arbitrary.
const KEY_ZONES = {
    kick:        'aeiou',       // vowels — the steady pulse
    snare:       'tnsrhld',     // common consonants — the backbeat
    rim:         'bcfgkm',
    hihatClosed: 'pvwy',        // remaining common letters — texture
    ride:        'qxzj'         // rare letters — accents
};

// Fallback voices for anything not matched by a zone above, Backspace/Delete
// excluded (digits, punctuation, etc.) — picked at random each time, since
// there's more than one option here.
const FALLBACK_VOICE = ['hihatOpen', 'tom', 'crash', 'ride'];

// Spacebar triggers all three of these together (a cluster hit, end-of-word
// accent) rather than a single voice — handled separately in
// handleDrumKeydown, not through the normal one-voice-per-key path below.
//const SPACE_VOICES = ['crash', 'hihatOpen', 'ride'];
//const DEL_VOICES = ['tom', 'ride', 'hihatOpen']


// Keys that shouldn't trigger any drum hit at all — pure modifiers/navigation.
const IGNORED_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
                      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                      'Home', 'End', 'Escape', 'Enter'];

function voiceForKey(rawKey) {
    if (IGNORED_KEYS.includes(rawKey)) return null; // no sound for these

    // Backspace/Delete get their own deliberate voice rather than falling
    // through to the random fallback pool like other non-letter keys.
    if (rawKey === 'Backspace' || rawKey === 'Delete') return 'ride';

    if (rawKey === ' ') return 'tom'; // spacebar = end-of-word accent

    let char = rawKey.toLowerCase();
    for (let voice in KEY_ZONES) {
        if (KEY_ZONES[voice].includes(char)) return voice;
    }
    // no zone matched (digits, punctuation, anything outside a-z) — pick
    // one of the fallback voices at random
    return FALLBACK_VOICE[Math.floor(Math.random() * FALLBACK_VOICE.length)];
}

// ---- 3. Audio context + sample loading ----
// Context is created immediately (allowed anytime) but stays 'suspended'
// until a real user gesture resumes it (browser autoplay policy). Decoding
// starts right away too, so the kit has the best chance of being ready by
// the time someone actually starts typing.
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let kitBuffers = {};   // voiceName -> array of decoded AudioBuffers (1-4 each)
let voiceCursor = {};  // voiceName -> round-robin index into that array
let kitReady = false;

async function loadKit() {
    let voiceNames = Object.keys(KIT_FILES);

    await Promise.all(
        voiceNames.map(async (voiceName) => {
            let paths = KIT_FILES[voiceName];
            let buffers = await Promise.all(
                paths.map(async (path) => {
                    try {
                        let response = await fetch(path);
                        let arrayBuffer = await response.arrayBuffer();
                        return await audioCtx.decodeAudioData(arrayBuffer);
                    } catch (err) {
                        console.warn(`Textual Automaton audio: couldn't load "${voiceName}" variation from ${path}`, err);
                        return null; // keep array position — filtered out next
                    }
                })
            );
            kitBuffers[voiceName] = buffers.filter(b => b !== null);
            voiceCursor[voiceName] = 0;
        })
    );

    kitReady = true;
}
loadKit();

// ---- 4. One-shot playback with round-robin variation + pitch/gain jitter ----
// AudioBufferSourceNode is disposable by design — fire it once, it cleans
// itself up when done. No pooling or manual lifecycle management needed,
// which is exactly why samples suit rapid, overlapping keystrokes better
// than a stateful synth would.
function playHit(voiceName, velocity = 1) {
    if (!voiceName) return; // voiceForKey returned null — an ignored key, no sound
    if (!kitReady) return; // still loading — skip silently rather than error
    let buffers = kitBuffers[voiceName];
    if (!buffers || buffers.length === 1) return; // no variation loaded for this voice

    // Step through this voice's variations in order, wrapping around —
    // guarantees no immediate repeat and even coverage across all of them.
    let idx = voiceCursor[voiceName] || 0;
    let buffer = buffers[idx];
    voiceCursor[voiceName] = (idx + 1) % buffers.length;

    let source = audioCtx.createBufferSource();
    let gainNode = audioCtx.createGain();

    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.8; // ±3% pitch jitter
    gainNode.gain.value = velocity * (0.85 + Math.random() * 0.85); // small gain jitter

    source.connect(gainNode).connect(audioCtx.destination);
    source.start(0);
}

// ---- 5. Small local helpers (kept independent of p5's globals on purpose) ----
function mapRange(value, inMin, inMax, outMin, outMax) {
    let t = (value - inMin) / (inMax - inMin);
    t = Math.max(0, Math.min(1, t));
    return outMin + t * (outMax - outMin);
}

// ---- 6. The actual trigger: typing speed → velocity ----
let lastKeyTime = 0;

function handleDrumKeydown(e) {
    // Resume the audio context on the first real keystroke — this is the
    // user gesture browsers require before audio is allowed to play.
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    let now = performance.now();
    let gap = now - lastKeyTime;
    lastKeyTime = now;

    // Fast typing (small gap) → louder hits. Slow/deliberate typing → softer.
    // Tune the 30/400 gap range and 0.4/1.0 velocity range to taste.
    let velocity = mapRange(gap, 20, 600, 1.0, 0.2);
    velocity = Math.max(0.4, Math.min(1.0, velocity));

    let voice = voiceForKey(e.key);
    playHit(voice, velocity);
}

window.addEventListener('load', function () {
    let input = document.getElementById('word-input');
    if (input) {
        input.addEventListener('keydown', handleDrumKeydown);
    }
});

// ═══════════════════════════════════════════════════════════════
// ---- 7. Mouse-driven trigger: X selects the voice, Y sets velocity ----
// X splits the screen into one zone per kit voice (in KIT_FILES order) —
// moving the mouse left to right scans through kick → snare → rim →
// hihatClosed → hihatOpen → tom → ride → crash. A hit only fires when the
// cursor crosses INTO a new zone (not on every pixel of movement), so
// dragging across the screen feels like scrubbing over a row of pads
// rather than flooding you with sound. Pressing down always fires
// immediately regardless of zone, satisfying "click triggers the sample
// itself" even without any movement at all.
// Y sets how loud whatever fires next is — top of the screen (y=0) is
// loudest, bottom is softest, recalculated fresh on every trigger, so
// moving vertically while dragging continuously changes hit volume.
// ═══════════════════════════════════════════════════════════════

const VOICE_ORDER = Object.keys(KIT_FILES); // scan order across the X axis, e.g. kick, snare, rim, ...

let mouseIsDown = false;
let lastVoiceIndex = null;

function isOverWordInput(x, y) {
    let el = document.getElementById('word-input');
    if (!el) return false;
    let r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function velocityForY(y, height) {
    // top (y=0) = loudest, bottom (y=height) = softest
    return mapRange(y, 0, height, 1.0, 0.3);
}

function triggerFromMouse(x, y, forceRetrigger) {
    if (isOverWordInput(x, y)) return; // don't fire drum hits while interacting with the text field

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    let zoneWidth = window.innerWidth / VOICE_ORDER.length;
    let index = Math.floor(x / zoneWidth);
    index = Math.max(0, Math.min(VOICE_ORDER.length - 1, index));

    // Only re-trigger on an actual zone change, UNLESS this is a fresh
    // mousedown — a click should always sound, even in the same spot twice.
    if (!forceRetrigger && index === lastVoiceIndex) return;
    lastVoiceIndex = index;

    let voice = VOICE_ORDER[index];
    let velocity = velocityForY(y, window.innerHeight);
    playHit(voice, velocity);
}

window.addEventListener('load', function () {
    window.addEventListener('mousedown', function (e) {
        mouseIsDown = true;
        triggerFromMouse(e.clientX, e.clientY, true);
    });

    window.addEventListener('mouseup', function () {
        mouseIsDown = false;
    });

    window.addEventListener('mousemove', function (e) {
        if (!mouseIsDown) return; // only scans while actively held/dragging
        triggerFromMouse(e.clientX, e.clientY, false);
    });
});
