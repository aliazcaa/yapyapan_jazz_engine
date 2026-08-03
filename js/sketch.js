// ═══════════════════════════════════════════════════════════════
    // TEXTUAL AUTOMATON — fullscreen p5.js sketch with a live-editable
    // word source. Conway's Game of Life where each living cell is a
    // word, pulled from whatever is currently typed in the top field —
    // the grid regenerates as you type, no confirm/apply step needed.
    // GLITCH RULE: a cell only glitches when it's about to die (its
    // neighbor count means it won't survive the next tick). A fresh
    // birth always renders clean; corruption is reserved for the
    // frames leading up to death. If the dying cell is touching a
    // different word, corrupted characters are bled FROM that
    // neighboring word; if it's dying in isolation, it falls back to
    // generic glitch symbols instead.
    // Font size and highlight presence/color each use their OWN
    // independent seed, so any one layer can be reshuffled without
    // touching the others.
    // ═══════════════════════════════════════════════════════════════

    const DEFAULT_TEXT = "is there any words that still linger in your head or heart?";

    // Turns any typed sentence into a clean array of individual words —
    // lowercased, stripped of punctuation, empty fragments removed.
    function wordsFromText(text) {
        return text
            .toLowerCase()
            .split(/\s+/)
            .map(w => w.replace(/[^\p{L}\p{N}'-]/gu, ''))
            .filter(w => w.length > 0);
    }

    let WORDS = wordsFromText(DEFAULT_TEXT);

    // Kept as an optional fallback if you want a random-symbol glitch mode
    // instead of / alongside the word-bleed mode — unused by default now.
    const GLITCH_CHARS = ['#','%','&','$','@','!','?','*','^','~','_','0','1','X','Z','/','\\'];

    // ---- Tweak these directly ----
    let params = {
        seed: 12345,             // controls the grid: initial layout, word choice, births
        fontSeed: 808,           // controls ONLY the font-size jitter pattern — independent of seed
        highlightSeed: 5555,     // controls ONLY which cells get highlighted + what color — independent of the above
        cellSize: 80,            // px per grid cell — bigger = fewer, more legible cells
        density: 0.6,            // 0–1, initial % of live cells
        speed: 6,                // frames per generation step — lower = faster life
        glitchIntensity: 0.2,    // 0–1, how aggressively crowded cells corrupt
        fontJitter: 0.2,         // 0–1, how much each cell's font size randomly varies
        highlightChance: 0.6,    // 0–1, chance a newly-born cell gets a highlight box
        colorPalette: ['#0c0c0c', '#fb002c', '#ffffff'] // [word color, glitch color, background]
    };

    let grid = [];
    let cols, rows;
    let frameCounter = 0;

    function makeSeededRandom(seed) {
        let s = seed % 2147483647;
        if (s <= 0) s += 2147483646;
        return function () {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }
    let fontRandom = makeSeededRandom(params.fontSeed);
    let highlightRandom = makeSeededRandom(params.highlightSeed);

    function setup() {
        createCanvas(windowWidth, windowHeight);
        initializeSystem();
    }

    function windowResized() {
        resizeCanvas(windowWidth, windowHeight);
        initializeSystem(); // grid dimensions changed, so rebuild cleanly
    }

    function makeCell() {
        return {
            alive: false, word: '', age: 0, foreignWords: [],
            sizeJitter: 1,
            hasHighlight: false, highlightColor: null, textColor: null
        };
    }

    function collectForeignNeighborWords(g, x, y, ownWord) {
        let foreign = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                let nx = (x + dx + cols) % cols;
                let ny = (y + dy + rows) % rows;
                let neighbor = g[nx][ny];
                if (neighbor.alive && neighbor.word !== ownWord) {
                    foreign.push(neighbor.word);
                }
            }
        }
        return foreign;
    }

    function randomSizeJitter() {
        let r = fontRandom();
        return (1 - params.fontJitter) + r * (2 * params.fontJitter);
    }

    function complementaryColor(c) {
        colorMode(HSB, 360, 100, 100);
        let h = (hue(c) + 180) % 360;
        let s = saturation(c);
        let b = brightness(c);
        let comp = color(h, s, b);
        colorMode(RGB, 255);
        return comp;
    }

    function rollHighlight() {
        if (highlightRandom() >= params.highlightChance) {
            return { hasHighlight: false, highlightColor: null, textColor: null };
        }
        colorMode(HSB, 360, 100, 100);
        let h = highlightRandom() * 360;
        let s = 55 + highlightRandom() * 45;
        let b = 65 + highlightRandom() * 55;
        let hColor = color(h, s, b);
        colorMode(RGB, 255);
        return {
            hasHighlight: true,
            highlightColor: hColor,
            textColor: complementaryColor(hColor)
        };
    }

    function reseedFont() {
        fontRandom = makeSeededRandom(params.fontSeed);
    }
    function reseedHighlight() {
        highlightRandom = makeSeededRandom(params.highlightSeed);
    }

    function initializeSystem() {
        randomSeed(params.seed);
        noiseSeed(params.seed);
        reseedFont();
        reseedHighlight();

        cols = max(1, floor(width / params.cellSize));
        rows = max(1, floor(height / params.cellSize));

        grid = [];
        for (let x = 0; x < cols; x++) {
            let column = [];
            for (let y = 0; y < rows; y++) {
                let cell = makeCell();
                if (random() < params.density) {
                    cell.alive = true;
                    cell.word = random(WORDS);
                    cell.age = 0;
                    cell.sizeJitter = randomSizeJitter();
                    Object.assign(cell, rollHighlight());
                }
                column.push(cell);
            }
            grid.push(column);
        }

        frameCounter = 0;
        background(params.colorPalette[2]);
    }

    function countAliveNeighbors(g, x, y) {
        let count = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                let nx = (x + dx + cols) % cols;
                let ny = (y + dy + rows) % rows;
                if (g[nx][ny].alive) count++;
            }
        }
        return count;
    }

    // ═══════════════════════════════════════════════════════════════
    // MOUSE INTERACTION — click a cell to toggle it alive/dead
    // ═══════════════════════════════════════════════════════════════

    function mousePressed() {
        if (isOverInput(mouseX, mouseY)) return; // don't toggle cells behind the input field
        if (mouseX < 0 || mouseX >= width || mouseY < 0 || mouseY >= height) return;

        let x = constrain(floor(mouseX / params.cellSize), 0, cols - 1);
        let y = constrain(floor(mouseY / params.cellSize), 0, rows - 1);
        toggleCell(x, y);
    }

    function toggleCell(x, y) {
        let cell = grid[x][y];
        if (cell.alive) {
            cell.alive = false;
            cell.word = '';
            cell.age = 0;
            cell.foreignWords = [];
            cell.hasHighlight = false;
            cell.highlightColor = null;
            cell.textColor = null;
        } else {
            cell.alive = true;
            cell.word = random(WORDS);
            cell.age = 0;
            cell.sizeJitter = randomSizeJitter();
            cell.foreignWords = collectForeignNeighborWords(grid, x, y, cell.word);
            Object.assign(cell, rollHighlight());
        }
    }

    function mouseDragged() {
        if (isOverInput(mouseX, mouseY)) return;
        if (mouseX < 0 || mouseX >= width || mouseY < 0 || mouseY >= height) return;

        let x = constrain(floor(mouseX / params.cellSize), 0, cols - 1);
        let y = constrain(floor(mouseY / params.cellSize), 0, rows - 1);

        let cell = grid[x][y];
        if (!cell.alive) {
            cell.alive = true;
            cell.word = random(WORDS);
            cell.age = 0;
            cell.sizeJitter = randomSizeJitter();
            cell.foreignWords = collectForeignNeighborWords(grid, x, y, cell.word);
            Object.assign(cell, rollHighlight());
        }
    }

    function isOverInput(px, py) {
        let el = document.getElementById('word-input');
        let r = el.getBoundingClientRect();
        return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
    }

    function step() {
        let next = [];
        for (let x = 0; x < cols; x++) {
            let column = [];
            for (let y = 0; y < rows; y++) {
                let current = grid[x][y];
                let n = countAliveNeighbors(grid, x, y);
                let cell = makeCell();

                if (current.alive && (n === 2 || n === 3)) {
                    cell.alive = true;
                    cell.word = current.word;
                    cell.age = current.age + 1;
                    cell.sizeJitter = current.sizeJitter;
                    cell.hasHighlight = current.hasHighlight;
                    cell.highlightColor = current.highlightColor;
                    cell.textColor = current.textColor;
                } else if (!current.alive && n === 3) {
                    cell.alive = true;
                    cell.word = random(WORDS);
                    cell.age = 0;
                    cell.sizeJitter = randomSizeJitter();
                    Object.assign(cell, rollHighlight());
                } else {
                    cell.alive = false;
                }

                if (cell.alive) {
                    cell.foreignWords = collectForeignNeighborWords(grid, x, y, cell.word);
                }

                column.push(cell);
            }
            next.push(column);
        }
        grid = next;
    }

    function draw() {
        frameCounter++;
        if (frameCounter % max(1, floor(params.speed)) === 0) {
            step();
        }

        let bg = color(params.colorPalette[2]);
        fill(red(bg), green(bg), blue(bg), 40);
        noStroke();
        rect(0, 0, width, height);

        textFont('Arial');
        textAlign(LEFT, CENTER);
        noStroke();

        let c1 = color(params.colorPalette[0]);
        let c2 = color(params.colorPalette[1]);

        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                let cell = grid[x][y];
                if (!cell.alive) continue;

                let word = cell.word;
                let baseTs = params.cellSize / (word.length * 0.62);
                let ts = constrain(baseTs * cell.sizeJitter, 5, 24);
                textSize(ts);
                let charW = textWidth('M');
                let totalW = charW * word.length;

                let cx = x * params.cellSize + params.cellSize / 2;
                let cy = y * params.cellSize + params.cellSize / 2;
                let startX = cx - totalW / 2;

                if (cell.hasHighlight) {
                    let padX = 4, padY = 3;
                    fill(cell.highlightColor);
                    noStroke();
                    rect(startX - padX, cy - ts / 2 - padY, totalW + padX * 2, ts + padY * 2, 3);
                }

                let interactionLevel = cell.foreignWords.length / 8;
                let ageFactor = constrain(cell.age / 20, 0, 1);
                let baseColor = cell.hasHighlight
                    ? cell.textColor
                    : lerpColor(c1, c2, ageFactor * 0.5);

                let n = countAliveNeighbors(grid, x, y);
                let willDie = !(n === 2 || n === 3);

                for (let k = 0; k < word.length; k++) {
                    let ch = word[k];
                    let usedGlitch = false;

                    if (willDie) {
                        let hasForeignContact = cell.foreignWords.length > 0;
                        let glitchProb = hasForeignContact
                            ? params.glitchIntensity * interactionLevel
                            : params.glitchIntensity;

                        if (random() < glitchProb) {
                            if (hasForeignContact) {
                                let sourceWord = random(cell.foreignWords);
                                ch = sourceWord[floor(random(sourceWord.length))];
                            } else {
                                ch = random(GLITCH_CHARS);
                            }
                            fill(c2);
                            usedGlitch = true;
                        }
                    }

                    if (!usedGlitch) fill(baseColor);
                    text(ch, startX + k * charW, cy);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // LIVE WORD INPUT — no apply/regenerate button; every keystroke
    // (debounced slightly so fast typing doesn't thrash the grid)
    // re-tokenizes the field and rebuilds the automaton immediately.
    // ═══════════════════════════════════════════════════════════════

    let liveUpdateTimer = null;

    function scheduleLiveUpdate() {
        clearTimeout(liveUpdateTimer);
        liveUpdateTimer = setTimeout(() => {
            let raw = document.getElementById('word-input').value;
            let parsed = wordsFromText(raw);
            if (parsed.length > 0) {
                WORDS = parsed;
                initializeSystem();
            }
            // if the field is temporarily empty (e.g. mid-backspace),
            // just keep showing the last valid word set rather than erroring
        }, 150);
    }

    window.addEventListener('load', function () {
        document.getElementById('word-input').addEventListener('input', scheduleLiveUpdate);
    });
