// Phase 1 style frame: one frozen moment of a round, built with the real
// scene code and the real UI styles. Nothing here is wired to game rules yet.
import '../src/ui/theme.css';
import '../src/ui/play.css';
import { layoutScene, mountScene, type SceneState } from '../src/art/scene';

const params = new URLSearchParams(location.search);
const limit = Number(params.get('limit') ?? 6);
const misses = Number(params.get('misses') ?? 2);
const state: SceneState = { limit, misses };

const answer = 'POLAR BEAR';
const hits = new Set(['A', 'E', 'R']);
const wrong = new Set(['S', 'T', 'N', 'I', 'U', 'D', 'C', 'M'].slice(0, misses));

const tiles = document.getElementById('tiles')!;
for (const word of answer.split(' ')) {
  const el = document.createElement('div');
  el.className = 'word';
  for (const ch of word) {
    const shown = hits.has(ch);
    el.insertAdjacentHTML('beforeend', `<span class="tile${shown ? '' : ' ice'}">${shown ? ch : ''}</span>`);
  }
  tiles.append(el);
}

const check = '<span class="mark"><svg viewBox="0 0 12 12"><path d="M2 6.5 5 9.5 10 3"/></svg></span>';
const cross = '<span class="mark"><svg viewBox="0 0 12 12"><path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"/></svg></span>';
const keyboard = document.getElementById('keyboard')!;
for (const row of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
  const el = document.createElement('div');
  el.className = 'krow';
  for (const ch of row) {
    const cls = hits.has(ch) ? ' hit' : wrong.has(ch) ? ' miss' : '';
    const label = hits.has(ch) ? `${ch}, correct` : wrong.has(ch) ? `${ch}, wrong` : ch;
    el.insertAdjacentHTML(
      'beforeend',
      `<button class="key${cls}" aria-label="${label}">${ch}${hits.has(ch) ? check : wrong.has(ch) ? cross : ''}</button>`,
    );
  }
  keyboard.append(el);
}

const stage = document.getElementById('stage')!;
const scorebar = document.getElementById('scorebar')!;
const quip = document.getElementById('quip')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const top = () => scorebar.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;

mountScene(canvas, () => state, top);

// Park the speech bubble beside Melvin's head.
function placeQuip() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const melt = misses / limit;
  const L = layoutScene(w, h, top(), melt);
  const headTop = 248 - 112 * melt;
  quip.style.left = `${L.melvin.x - 46 * L.melvin.scale}px`;
  quip.style.top = `${L.melvin.ground - (headTop - 34) * L.melvin.scale}px`;
}
new ResizeObserver(placeQuip).observe(stage);
placeQuip();
