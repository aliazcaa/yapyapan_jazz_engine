// ═══════════════════════════════════════════════════════════════
// PROCRASTINATION TIMER — starts on the first keystroke, shows a
// running stopwatch top-left, and pops up a reminder after the limit.
//
// TEMPORARY DEBUG BUILD: console.log() checkpoints added at every key
// transition so you can watch exactly what happens in DevTools → Console.
// Remove the console.log lines once this is confirmed working.
// ═══════════════════════════════════════════════════════════════

const SESSION_LIMIT_SECONDS = 1 * 60; // currently 1 minute for testing
const REMINDER_MESSAGE = "Now get back to work! Enough for procrastinating :)";

let elapsedSeconds = 0;
let intervalId = null;
let hasStarted = false;

function createStopwatchElement() {
    let el = document.createElement('div');
    el.id = 'procrastination-timer';
    el.style.position = 'fixed';
    el.style.top = '20px';
    el.style.left = '20px';
    el.style.zIndex = '20';
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.fontSize = '14px';
    el.style.color = '#0c0c0c';
    el.style.background = '#ffffff';
    el.style.border = '1px solid rgba(12, 12, 12, 0.2)';
    el.style.borderRadius = '6px';
    el.style.padding = '6px 12px';
    el.style.boxShadow = '0 2px 8px rgba(12, 12, 12, 0.08)';
    el.textContent = '00:00';
    document.body.appendChild(el);
    console.log('[timer] stopwatch element created and appended to body');
    return el;
}

function formatTime(totalSeconds) {
    let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    let s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function createPopupElement() {
    let overlay = document.createElement('div');
    overlay.id = 'procrastination-popup-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(12, 12, 12, 0.6)';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '2147483647'; // max safe z-index, guarantees it's on top of literally everything

    let box = document.createElement('div');
    box.style.background = '#ffffff';
    box.style.borderRadius = '10px';
    box.style.padding = '32px 28px';
    box.style.maxWidth = 'min(360px, calc(100vw - 48px))';
    box.style.textAlign = 'center';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.boxShadow = '0 8px 24px rgba(12, 12, 12, 0.2)';

    let message = document.createElement('p');
    message.textContent = REMINDER_MESSAGE;
    message.style.fontSize = '16px';
    message.style.color = '#0c0c0c';
    message.style.marginBottom = '20px';
    message.style.lineHeight = '1.4';

    let button = document.createElement('button');
    button.textContent = 'Okay, back to work';
    button.style.background = '#fb002c';
    button.style.color = '#ffffff';
    button.style.border = 'none';
    button.style.borderRadius = '6px';
    button.style.padding = '10px 20px';
    button.style.fontSize = '14px';
    button.style.fontFamily = 'inherit';
    button.style.cursor = 'pointer';
    button.addEventListener('click', dismissPopupAndRestart);

    box.appendChild(message);
    box.appendChild(button);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    console.log('[timer] popup element created and appended to body (hidden)');
    return overlay;
}

let stopwatchEl = null;
let popupOverlayEl = null;

function tick() {
    elapsedSeconds++;
    stopwatchEl.textContent = formatTime(elapsedSeconds);
    console.log('[timer] tick — elapsedSeconds =', elapsedSeconds, '/', SESSION_LIMIT_SECONDS);

    if (elapsedSeconds >= SESSION_LIMIT_SECONDS) {
        console.log('[timer] limit reached — calling showPopup()');
        showPopup();
    }
}

function startTimer() {
    if (hasStarted) {
        return;
    }
    hasStarted = true;
    console.log('[timer] first keystroke detected — starting interval');
    intervalId = setInterval(tick, 1000);
}

function showPopup() {
    clearInterval(intervalId);
    intervalId = null;
    popupOverlayEl.style.display = 'flex';
    console.log('[timer] popup display set to flex — overlay in DOM:', document.body.contains(popupOverlayEl));
}

function dismissPopupAndRestart() {
    popupOverlayEl.style.display = 'none';
    elapsedSeconds = 0;
    stopwatchEl.textContent = formatTime(elapsedSeconds);
    intervalId = setInterval(tick, 1000);
    console.log('[timer] popup dismissed, timer restarted');
}

window.addEventListener('load', function () {
    console.log('[timer] load event fired — creating elements and attaching listener');
    stopwatchEl = createStopwatchElement();
    popupOverlayEl = createPopupElement();

    let input = document.getElementById('word-input');
    console.log('[timer] #word-input found?', !!input);
    if (input) {
        input.addEventListener('keydown', startTimer);
    }
});
