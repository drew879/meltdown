// The play screen in the cut-paper look, served as the site's front page.
// The rules here are a small stand-in so the screen can be tapped through;
// the real engine, with tests, comes in Phase 3.
//
// Query: ?a=answer  &c=category  &limit=4|6|8  &g=letters already guessed
import './paper.css';
import manifest from './art-manifest.json';

type Piece = keyof typeof manifest;
const art = (name: Piece) => `${import.meta.env.BASE_URL}art/${name}.webp`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Longest answer the banner is built to hold. */
export const MAX_ANSWER = 45;

const params = new URLSearchParams(location.search);
const ANSWER = (params.get('a') ?? 'Six Flags Great Adventure').trim().replace(/\s+/g, ' ').slice(0, MAX_ANSWER);
const CATEGORY = params.get('c') ?? 'Place';
const LIMIT = [4, 6, 8].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 6;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('still');

const fold = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const isLetter = (ch: string) => /^[A-Z]$/.test(fold(ch));
const answerLetters = new Set([...ANSWER].filter(isLetter).map(fold));

const guesses: string[] = [];
const misses = () => guesses.filter((g) => !answerLetters.has(g)).length;
const won = () => [...answerLetters].every((l) => guesses.includes(l));
const lost = () => misses() >= LIMIT;
/** Nine drawn stages, 0 (fresh) to 8 (puddle), shared by every difficulty. */
const stage = () => (won() ? 0 : Math.round((Math.min(misses(), LIMIT) * 8) / LIMIT));

const yard = $<HTMLImageElement>('yard');
const scene = $('scene');
const sun = $<HTMLImageElement>('sun');
const snowman = $<HTMLImageElement>('snowman');
const thermo = $('thermo');
const mercury = $('mercury');
const sign = $('sign');
const signbox = $('signbox');
const board = $('board');
const answerEl = $('answer');
const tray = $('tray');
const again = $<HTMLButtonElement>('again');

yard.src = art('backyard');
$('category').textContent = CATEGORY;
for (const name of Object.keys(manifest) as Piece[]) new Image().src = art(name); // no flicker when a piece is swapped in

// ---- keyboard ----
const keys = new Map<string, HTMLButtonElement>();
for (const row of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
  const el = document.createElement('div');
  el.className = 'pp-krow';
  for (const ch of row) {
    const key = document.createElement('button');
    key.className = 'pp-key';
    key.textContent = ch;
    key.addEventListener('click', () => guess(ch));
    keys.set(ch, key);
    el.append(key);
  }
  tray.append(el);
}
addEventListener('keydown', (e) => {
  if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[a-zA-Z]$/.test(e.key)) guess(e.key.toUpperCase());
});

// ---- thermometer notches ----
for (let i = 1; i <= LIMIT; i++) {
  const n = document.createElement('i');
  n.className = 'pp-notch';
  n.style.top = `${(1 - i / LIMIT) * 100 + 0.5}%`;
  thermo.append(n);
}

// ---- the answer on its garden sign ----
/** The sign holds at most this many rows. */
const MAX_ROWS = 3;
/** The biggest a letter gets. Shorter screens get a smaller cap, so the sign leaves room for the snowman. */
const maxSlot = () => Math.max(20, Math.min(38, innerHeight * 0.04));
/** A sign never gets thinner than this, however small its letters. */
const MIN_BOARD = 40;
/** A gap between words, in letter-widths. */
const SPACE = 0.6;
/**
 * Three pictures of the same board, from long and low to nearly square.
 * `end` is how much of the picture's width each ragged, nailed end takes.
 */
const SIGNS: { piece: Piece; end: number }[] = [
  { piece: 'sign-1', end: 0.11 },
  { piece: 'sign-2', end: 0.11 },
  { piece: 'sign-3', end: 0.11 },
];

interface Fit {
  /** Width of one letter, in pixels. */
  slot: number;
  rows: string[][];
  width: number;
  height: number;
  /** Width of each end of the board, in pixels. */
  end: number;
  sign: (typeof SIGNS)[number];
}

const rowWidth = (row: string[]) => row.reduce((n, w) => n + [...w].length, 0) + SPACE * (row.length - 1);

/** Split the words into exactly `count` rows so that the longest row is as short as possible. */
function split(words: string[], count: number): string[][] {
  let best: string[][] = [words];
  let bestWidth = Infinity;
  const go = (start: number, left: number, rows: string[][]) => {
    if (left === 1) {
      const all = [...rows, words.slice(start)];
      const widest = Math.max(...all.map(rowWidth));
      if (widest < bestWidth) {
        bestWidth = widest;
        best = all;
      }
      return;
    }
    for (let end = start + 1; end <= words.length - (left - 1); end++) go(end, left - 1, [...rows, words.slice(start, end)]);
  };
  go(0, count, []);
  return best;
}

/** The biggest letters these rows can have on a sign no wider than `maxWidth`. */
function fitRows(rows: string[][], maxWidth: number): Fit {
  const across = Math.max(...rows.map(rowWidth), 4.5) + 0.9; // letters, plus a little air
  const tall = 1.6 * rows.length + (rows.length === 1 ? 1.55 : 1.2); // rows, plus plain wood above and below
  let best: Fit | null = null;
  let bestScore = -Infinity;
  for (const sign of SIGNS) {
    const img = manifest[sign.piece];
    const endPerHeight = (sign.end * img.w) / img.h; // the ends keep their shape, so they grow with the height
    let slot = Math.min(maxSlot(), maxWidth / (across + 2 * tall * endPerHeight));
    if (slot * tall < MIN_BOARD) slot = Math.min(slot, (maxWidth - 2 * MIN_BOARD * endPerHeight) / across);
    slot = Math.floor(slot * 2) / 2;
    const height = Math.max(slot * tall, MIN_BOARD);
    const end = height * endPerHeight;
    const inner = slot * across;
    // how far the plain middle of the board is stretched from its natural shape
    const natural = height * (img.w / img.h) * (1 - 2 * sign.end);
    const stretch = Math.abs(Math.log(inner / natural));
    // bigger letters are better, unless the wood has to be pulled far out of shape
    const score = slot - Math.max(0, stretch - 0.6) * 40;
    if (score > bestScore) {
      bestScore = score;
      best = { slot, rows, width: inner + 2 * end, height, end, sign };
    }
  }
  return best!;
}

/**
 * Lay the answer out on the sign. Fewer rows are preferred as long as the
 * letters stay big: a short answer sits on one row, and a 45-character title
 * steps down to smaller letters on three.
 */
function fitAnswer(maxWidth: number): Fit {
  const words = ANSWER.split(' ');
  const k = Math.min(1, maxWidth / 400);
  const worth = [30 * k, 26 * k]; // letters this big are worth keeping on one row, or on two
  let best: Fit | null = null;
  for (let count = 1; count <= Math.min(MAX_ROWS, words.length); count++) {
    const fit = fitRows(split(words, count), maxWidth);
    if (count <= worth.length && fit.slot >= worth[count - 1]!) return fit;
    if (!best || fit.slot > best.slot) best = fit;
  }
  return best!;
}

// the post, and the flowers, snow and grass at the foot of the sign
const BITS: [Piece, string][] = [
  ['post', 'post'],
  ['snow-1', 'sl'],
  ['snow-2', 'sr'],
  ['grass-2', 'gl'],
  ['grass-4', 'gr'],
  ['crocus-yellow-2', 'fl2'],
  ['crocus-purple-2', 'fr2'],
  ['crocus-purple-1', 'fl'],
  ['crocus-yellow-1', 'fr'],
];
for (const [piece, place] of BITS) {
  const img = new Image();
  img.src = art(piece);
  img.alt = '';
  img.className = `pp-bit ${place}`;
  signbox.append(img);
}

function drawAnswer(popLetter?: string) {
  const fit = fitAnswer(Math.min(600, sign.clientWidth - 40));
  const { slot, rows } = fit;
  board.style.width = `${fit.width}px`;
  board.style.height = `${fit.height}px`;
  board.style.borderWidth = `0 ${fit.end}px`;
  board.style.borderImageSource = `url(${art(fit.sign.piece)})`;
  board.style.borderImageSlice = `0 ${fit.sign.end * 100}% fill`;
  board.style.borderImageWidth = `0 ${fit.end}px`;
  signbox.style.setProperty('--flower', `${Math.max(46, Math.min(72, 30 + fit.height * 0.42))}px`);
  answerEl.style.setProperty('--slot', `${slot}px`);
  answerEl.replaceChildren();
  const over = lost();
  for (const row of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'pp-row';
    for (const word of row) {
      const wordEl = document.createElement('div');
      wordEl.className = 'pp-word';
      for (const ch of word) {
        const s = document.createElement('span');
        s.className = 'pp-slot';
        if (!isLetter(ch)) s.textContent = ch; // numbers and punctuation are simply shown
        else {
          const l = fold(ch);
          s.classList.add('letter');
          if (guesses.includes(l)) s.textContent = ch.toUpperCase();
          else if (over) {
            s.textContent = ch.toUpperCase();
            s.classList.add('missed');
          }
          if (l === popLetter && !reduceMotion) s.classList.add('pop');
        }
        wordEl.append(s);
      }
      rowEl.append(wordEl);
    }
    answerEl.append(rowEl);
  }
  const shown = [...ANSWER].map((ch) => (!isLetter(ch) ? ch : guesses.includes(fold(ch)) || over ? ch : 'blank')).join(' ');
  answerEl.setAttribute('aria-label', `${CATEGORY}: ${shown}`);
}

// ---- the scene ----
let sunMood: 'smug' | 'gleeful' | 'annoyed' | 'dismayed' = 'smug';
let moodTimer = 0;
function setSun(mood: typeof sunMood, forMs = 0) {
  clearTimeout(moodTimer);
  sunMood = mood;
  sun.src = art(`sun-${mood}`);
  if (forMs) moodTimer = window.setTimeout(() => setSun(lost() ? 'gleeful' : 'smug'), forMs);
}

let shownStage = -1;
function layout() {
  const W = innerWidth;
  const H = innerHeight;
  const box = scene.getBoundingClientRect();
  const heat = Math.min(1, misses() / LIMIT);

  // the snowman: every stage shares one scale, set by how tall the fresh one should stand
  const full = Math.min(box.height * 0.82, box.width * 0.8);
  const k = full / manifest['snowman-0'].h;
  const piece = manifest[`snowman-${shownStage < 0 ? stage() : shownStage}` as Piece];
  const baseY = box.height * 0.985;
  snowman.style.width = `${piece.w * k}px`;
  snowman.style.height = `${piece.h * k}px`;
  snowman.style.left = `${box.width * 0.48 - (piece.w * k) / 2}px`;
  snowman.style.top = `${baseY - piece.h * k}px`;

  // the sun grows and leans in as the heat rises
  const sunSize = Math.min(box.width * 0.3, box.height * 0.42) * (1 + 0.38 * heat);
  sun.style.width = `${sunSize}px`;
  sun.style.left = `${box.width * (0.03 + 0.04 * heat)}px`;
  sun.style.top = `${box.height * (0.05 + 0.05 * heat)}px`;

  // the thermometer
  const tw = Math.max(20, Math.min(30, box.height * 0.08));
  const th = Math.min(box.height * 0.5, 200);
  thermo.style.setProperty('--w', `${tw}px`);
  thermo.style.height = `${th}px`;
  thermo.style.right = `${Math.max(14, box.width * 0.06)}px`;
  thermo.style.top = `${box.height * 0.05}px`;
  mercury.style.height = `${th * heat + tw * 0.6}px`;

  // the yard: slide the painting so its grass line sits behind the snowman's middle
  const ar = manifest.backyard.h / manifest.backyard.w;
  const GRASS = 0.4975; // where the fence meets the grass, as a fraction of the painting's height
  const grassY = box.top + baseY - full * 0.4;
  let pw = W;
  let ph = W * ar;
  let top = grassY - ph * GRASS;
  if (top > 0) {
    ph = grassY / GRASS;
    pw = ph / ar;
    top = 0;
  }
  yard.style.width = `${pw}px`;
  yard.style.height = `${ph}px`;
  yard.style.left = `${W - pw}px`;
  yard.style.top = `${top}px`;
  // below the painting there is only grass, which the page colour continues
  void H;
}

function showStage(next: number, animate: boolean) {
  const apply = () => {
    shownStage = next;
    snowman.src = art(`snowman-${next}` as Piece);
    layout();
  };
  if (!animate || reduceMotion || shownStage === next) return apply();
  // a stop-motion pop: squash, swap the piece, spring back
  snowman
    .animate([{ transform: 'scale(1.07, 0.9)' }, { transform: 'scale(1.1, 0.86)' }], { duration: 170, easing: 'steps(2, jump-none)' })
    .finished.then(() => {
      apply();
      snowman.animate(
        [{ transform: 'scale(0.93, 1.09)' }, { transform: 'scale(1.04, 0.96)' }, { transform: 'scale(1, 1)' }],
        { duration: 300, easing: 'steps(3, jump-none)' },
      );
    });
}

function describe() {
  const left = LIMIT - misses();
  const words = ['fresh and proud', 'a little worried', 'starting to slump', 'slumping', 'getting shorter', 'half melted', 'mostly melted', 'nearly gone', 'a puddle'];
  snowman.alt = `The snowman is ${words[stage()]}. ${left} ${left === 1 ? 'miss' : 'misses'} left.`;
}

function guess(ch: string) {
  if (guesses.includes(ch) || won() || lost()) return; // repeats and late taps are ignored
  guesses.push(ch);
  const hit = answerLetters.has(ch);
  const key = keys.get(ch)!;
  key.classList.add(hit ? 'hit' : 'miss');
  key.setAttribute('aria-label', `${ch}, ${hit ? 'correct' : 'wrong'}`);
  key.disabled = !hit ? true : key.disabled;
  drawAnswer(hit ? ch : undefined);
  if (won()) setSun('dismayed');
  else if (lost()) setSun('gleeful');
  else setSun(hit ? 'annoyed' : 'gleeful', hit ? 1100 : 1500);
  if (hit && !won() && !reduceMotion) {
    snowman.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-5%)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'steps(3, jump-none)' });
  }
  showStage(stage(), true);
  describe();
  again.hidden = !(won() || lost());
}

again.addEventListener('click', () => location.assign(location.pathname + location.search.replace(/([?&])g=[^&]*/, '$1')));

// ---- start ----
setSun('smug');
for (const ch of (params.get('g') ?? '').toUpperCase()) {
  if (/[A-Z]/.test(ch) && !guesses.includes(ch) && !won() && !lost()) {
    guesses.push(ch);
    const hit = answerLetters.has(ch);
    keys.get(ch)!.classList.add(hit ? 'hit' : 'miss');
  }
}
if (won()) setSun('dismayed');
else if (lost()) setSun('gleeful');
again.hidden = !(won() || lost());
const refresh = () => {
  showStage(stage(), false);
  drawAnswer();
  layout(); // the sign's height feeds the scene's height, so lay out once more
  describe();
};
new ResizeObserver(refresh).observe(document.body);
document.fonts.ready.then(refresh);
refresh();
