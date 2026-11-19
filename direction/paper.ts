// Phase 1 proof: the play screen built for real in the cut-paper look.
// The rules here are a small stand-in so the screen can be tapped through;
// the real engine, with tests, comes in Phase 3.
//
// Query: ?a=answer  &c=category  &limit=4|6|8  &g=letters already guessed
import '../src/paper/paper.css';
import manifest from '../src/paper/art-manifest.json';

type Piece = keyof typeof manifest;
const art = (name: Piece) => `${import.meta.env.BASE_URL}art/${name}.webp`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Longest answer the banner is built to hold. */
export const MAX_ANSWER = 60;

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
const banner = $('banner');
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

// ---- the answer on its banner ----
/**
 * Pick the biggest letter size at which the answer fits the banner, wrapping
 * between words. Short answers get big letters; a 60-character title drops to
 * a smaller size over up to five rows.
 */
function fitAnswer(width: number): { slot: number; rows: string[][] } {
  const words = ANSWER.split(' ');
  for (const slot of [38, 34, 30, 27, 24, 22, 20, 18, 16, 15, 14, 13, 12]) {
    const perRow = Math.floor(width / slot);
    if (words.some((w) => [...w].length > perRow)) continue;
    const rows: string[][] = [[]];
    let used = 0;
    for (const w of words) {
      const len = [...w].length;
      const need = used === 0 ? len : used + 0.6 + len;
      if (need > perRow && used > 0) {
        rows.push([w]);
        used = len;
      } else {
        rows.at(-1)!.push(w);
        used = need;
      }
    }
    if (rows.length <= (slot >= 34 ? 2 : slot >= 24 ? 3 : slot >= 17 ? 4 : 5)) return { slot, rows };
  }
  return { slot: 12, rows: [words] };
}

function drawAnswer(popLetter?: string) {
  const width = banner.clientWidth - 24;
  const { slot, rows } = fitAnswer(width);
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

/** A slightly ragged outline, so the banner looks torn, not cut by a machine. */
function tearBanner() {
  const w = banner.offsetWidth;
  const h = banner.offsetHeight;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  const pts: string[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 13));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const jx = y0 === y1 ? 0 : rnd() * 1.6 + 1.6;
      const jy = y0 === y1 ? rnd() * 1.6 + 1.6 : 0;
      pts.push(`${(x0 + (x1 - x0) * t + (x0 === 0 ? jx : -jx)).toFixed(1)}px ${(y0 + (y1 - y0) * t + (y0 === 0 ? jy : -jy)).toFixed(1)}px`);
    }
  };
  edge(0, 0, w, 0);
  edge(w, 0, w, h);
  edge(w, h, 0, h);
  edge(0, h, 0, 0);
  banner.style.clipPath = `polygon(${pts.join(',')})`;
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
  if (lost()) tearBanner();
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
  tearBanner();
  layout(); // the banner's height feeds the scene's height, so lay out once more
  describe();
};
new ResizeObserver(refresh).observe(document.body);
document.fonts.ready.then(refresh);
refresh();
