// A mock-up page for Phase 2's melt: three beats for a wrong guess and three
// loss sequences, for Drew to choose from. It is not part of the game and the
// game does not load it. Delete it (with melt.html, melt.css, melt-timeline.ts
// and standins/) once the chosen melt is built for real.
//
// Everything is drawn from one clock: missFrame / lossFrame in melt-timeline.ts
// say where every piece is t ms after the guess. Pieces that would need new art
// use rough stand-ins: the hat, carrot and bare puddle are cut from stage 8
// (standins/), and the flare, heat wiggles, drops, beam, bubbles and closed
// eyes are drawn here in code.
//
//   ?diff=easy|normal|hard  &miss=flare|slump|beam  &loss=sploosh|hat|sink
//   &misses=2               start with this many misses already made
//   &play=miss|loss         play the next miss (or the loss) at once
//   &at=600                 freeze at 600 ms into it (for frame strips)
//   &bare=1                 hide the controls (for frame strips)
import '../paper/paper.css';
import '../app/screens.css';
import './melt.css';
import { el } from '../app/dom';
import { LOSS_HEADINGS } from '../app/copy';
import { art, manifest, type Piece } from '../paper/art';
import { createYard, placeYard } from '../paper/yard';
import {
  LOSS_MS,
  LOSS_OPTIONS,
  MISS_MS,
  MISS_OPTIONS,
  lossFrame,
  missFrame,
  stageFor,
  stageHeight,
  type Frame,
  type LossOption,
  type MissOption,
  type Particle,
} from './melt-timeline';
import standins from './standins/standins.json';
import puddleBaseUrl from './standins/puddle-base.png';
import puddlePlainUrl from './standins/puddle-plain.png';
import puddleHatUrl from './standins/puddle-hat.png';
import puddleCarrotUrl from './standins/puddle-carrot.png';
import hat6Url from './standins/hat-6.png';
import hat7Url from './standins/hat-7.png';

type Diff = 'easy' | 'normal' | 'hard';
const LIMITS: Record<Diff, number> = { easy: 8, normal: 6, hard: 4 };

const params = new URLSearchParams(location.search);
const pick = <T extends string>(key: string, options: readonly T[], fallback: T): T =>
  (options as readonly string[]).includes(params.get(key) ?? '') ? (params.get(key) as T) : fallback;

const state = {
  diff: pick<Diff>('diff', ['easy', 'normal', 'hard'], 'normal'),
  miss: pick<MissOption>('miss', ['flare', 'slump', 'beam'], 'flare'),
  loss: pick<LossOption>('loss', ['sploosh', 'hat', 'sink'], 'sploosh'),
  misses: 0,
  /** what is playing: the beat into `misses`, the loss, or nothing */
  playing: null as null | { kind: 'miss' | 'loss'; from: number; to: number; heatFrom: number; heatTo: number; t0: number },
  auto: false,
  reduced: false,
};
const limit = () => LIMITS[state.diff];
state.misses = Math.max(0, Math.min(limit() - 1, Number(params.get('misses') ?? 0) || 0));

// ---- the pieces ----
const root = document.getElementById('pp') as HTMLElement;
const yard = createYard();
const flare = el('div', { class: 'mp-flare', hidden: true });
const sunImg = el('img', { class: 'mp-sun-img', alt: '', src: art('sun-smug') });
const sun = el('div', { class: 'mp-sun' }, sunImg);
const mercury = el('div', { class: 'pp-mercury' });
const thermo = el('div', { class: 'pp-thermo mp-thermo', 'aria-hidden': 'true' }, mercury);
const svgNS = 'http://www.w3.org/2000/svg';
const beamSvg = document.createElementNS(svgNS, 'svg');
beamSvg.classList.add('mp-beam');
const beamPath = document.createElementNS(svgNS, 'polygon');
beamSvg.append(beamPath);

const stageImgs = new Map<string, HTMLImageElement>();
const bodySrc = (b: number | 'puddle') => (b === 'puddle' ? puddleBaseUrl : art(`snowman-${b}` as Piece));
const body = el('img', { class: 'mp-body-img', alt: '' });
const bodyWrap = el('div', { class: 'mp-body' }, body);
const spread = el('img', { class: 'mp-spread', alt: '', src: puddlePlainUrl, hidden: true });
const hat = el('img', { class: 'mp-hat', alt: '', hidden: true });
const carrot = el('img', { class: 'mp-carrot', alt: '', src: puddleCarrotUrl, hidden: true });
const lids = standins.puddle.eyes.map(() => el('div', { class: 'mp-lid', hidden: true }));
const shadow = el('div', { class: 'mp-ground' });
const actor = el('div', { class: 'mp-actor' }, spread, bodyWrap, carrot, ...lids, hat);
const particles = el('div', { class: 'mp-particles' });
/** heat wiggles rise behind him, so they never cover his face */
const behind = el('div', { class: 'mp-particles behind' });
const heading = el('p', { class: 'mp-heading', hidden: true });
const skipHint = el('p', { class: 'mp-skip', hidden: true }, 'Tap to skip');
const scene = el(
  'section',
  { class: 'mp-scene', 'aria-label': 'The snowman in the yard', onclick: () => skip() },
  flare,
  sun,
  thermo,
  beamSvg,
  shadow,
  behind,
  actor,
  particles,
  heading,
  skipHint,
);

// ---- the controls ----
function chips<T extends string>(label: string, options: { id: T; name: string }[], get: () => T, set: (v: T) => void) {
  const buttons = options.map((o) =>
    el('button', { class: 'mp-chip', type: 'button', 'aria-pressed': 'false', onclick: () => { set(o.id); paint(); } }, o.name),
  );
  const row = el('div', { class: 'mp-chips', role: 'group', 'aria-label': label }, el('span', { class: 'mp-chips-label' }, label), ...buttons);
  return { row, paint: () => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i]!.id === get()))) };
}
const diffChips = chips<Diff>(
  'Difficulty',
  [
    { id: 'easy', name: 'Easy · 8' },
    { id: 'normal', name: 'Normal · 6' },
    { id: 'hard', name: 'Hard · 4' },
  ],
  () => state.diff,
  (v) => {
    state.diff = v;
    startOver();
  },
);
const missChips = chips<MissOption>('Miss', MISS_OPTIONS, () => state.miss, (v) => (state.miss = v));
const lossChips = chips<LossOption>('Loss', LOSS_OPTIONS, () => state.loss, (v) => (state.loss = v));
const blurb = el('p', { class: 'mp-blurb' });
const status = el('p', { class: 'mp-status', 'aria-live': 'polite' });
const missBtn = el('button', { class: 'pp-btn', type: 'button', onclick: () => miss() }, 'Wrong guess');
const replayBtn = el('button', { class: 'pp-btn alt', type: 'button', onclick: () => replay() }, 'Replay');
const roundBtn = el('button', { class: 'pp-btn alt', type: 'button', onclick: () => playRound() }, 'Play a whole round');
const resetBtn = el('button', { class: 'pp-btn alt', type: 'button', onclick: () => startOver() }, 'Start over');
const lossBtn = el('button', { class: 'pp-btn alt', type: 'button', onclick: () => jumpToLoss() }, 'Just the loss');
const reducedBtn = el('button', { class: 'pp-btn alt', type: 'button', 'aria-pressed': 'false', onclick: () => { state.reduced = !state.reduced; paint(); } });
const panel = el(
  'section',
  { class: 'mp-panel', 'aria-label': 'Choose the melt' },
  el('p', { class: 'mp-label' }, 'Mock-up: the melt'),
  diffChips.row,
  missChips.row,
  lossChips.row,
  blurb,
  el('div', { class: 'mp-row two' }, missBtn, replayBtn),
  el('div', { class: 'mp-row three' }, roundBtn, lossBtn, resetBtn),
  el('div', { class: 'mp-row one' }, reducedBtn),
  status,
);
if (params.get('bare') === '1') root.classList.add('bare');
root.style.setProperty('--cloud', `url(${art('cloud')})`);
root.append(yard, scene, panel);

function paint() {
  diffChips.paint();
  missChips.paint();
  lossChips.paint();
  const m = MISS_OPTIONS.find((o) => o.id === state.miss)!;
  const l = LOSS_OPTIONS.find((o) => o.id === state.loss)!;
  blurb.replaceChildren(el('b', {}, `Miss ${m.name}: `), m.blurb, el('br'), el('b', {}, `Loss ${l.name}: `), l.blurb);
  const lost = state.playing?.kind === 'loss' || state.misses >= limit();
  status.textContent = lost
    ? `Lost: ${limit()} of ${limit()} misses. Tap the yard to skip the melt.`
    : `${state.misses} of ${limit()} misses · stage ${stageFor(state.misses, limit())} of 8`;
  missBtn.disabled = lost && !state.playing;
  reducedBtn.setAttribute('aria-pressed', String(state.reduced));
  reducedBtn.textContent = `Reduced motion (end state only): ${state.reduced ? 'on' : 'off'}`;
}

// ---- layout, worked out the way the play screen does it ----
let W = 0;
let H = 0;
let full = 0;
let k = 0;
let baseY = 0;
let cx = 0;
function layout() {
  const box = scene.getBoundingClientRect();
  W = box.width;
  H = box.height;
  full = Math.min(H * 0.82, W * 0.8);
  k = full / manifest['snowman-0'].h;
  baseY = H * 0.985;
  cx = W * 0.48;
  actor.style.left = `${cx}px`;
  actor.style.top = `${baseY}px`;
  beamSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const th = Math.min(H * 0.5, 200);
  const tw = Math.max(20, Math.min(30, H * 0.08));
  thermo.style.setProperty('--w', `${tw}px`);
  thermo.style.height = `${th}px`;
  thermo.style.right = `${Math.max(14, W * 0.06)}px`;
  thermo.style.top = `${H * 0.05 + 14}px`;
  placeYard(yard, box.top + baseY - full * 0.4);
  // the stand-ins sit where they lie in their source pictures
  const P = standins.puddle;
  place(carrot, P.carrot, P.w, P.h);
  standins.puddle.eyes.forEach((e, i) => {
    const lid = lids[i]!;
    lid.style.left = `${(e.cx - P.w / 2 - e.rx) * k}px`;
    lid.style.top = `${(e.cy - P.h - e.ry) * k}px`;
    lid.style.width = `${2 * e.rx * k}px`;
    lid.style.height = `${2 * e.ry * k}px`;
  });
  spread.style.width = `${P.w * k}px`;
  spread.style.height = `${P.h * k}px`;
  spread.style.left = `${(-P.w * k) / 2}px`;
  spread.style.top = `${-P.h * k}px`;
  shadow.style.width = `${full * 0.7}px`;
  shadow.style.left = `${cx - full * 0.35}px`;
  shadow.style.top = `${baseY - 8}px`;
  draw(lastFrame);
}
/** Puts a stand-in where it lies in a source picture drawn with its feet at the actor's anchor. */
function place(img: HTMLElement, b: { x: number; y: number; w: number; h: number }, srcW: number, srcH: number) {
  img.style.left = `${(b.x - srcW / 2) * k}px`;
  img.style.top = `${(b.y - srcH) * k}px`;
  img.style.width = `${b.w * k}px`;
  img.style.height = `${b.h * k}px`;
}
function hatHome(piece: 'hat-6' | 'hat-7' | 'puddle-hat') {
  const s = piece === 'puddle-hat' ? { w: standins.puddle.w, h: standins.puddle.h, box: standins.puddle.hat } : standins[piece];
  return { left: (s.box.x - s.w / 2) * k, top: (s.box.y - s.h) * k, w: s.box.w * k, h: s.box.h * k };
}

// ---- one frame ----
let lastFrame: Frame | null = null;
let shownBody: number | 'puddle' | null = null;
let shownMood = '';
const pool: HTMLElement[] = [];
function draw(f: Frame | null) {
  lastFrame = f;
  if (!f || !full) return;

  // the snowman
  if (f.body !== shownBody) {
    shownBody = f.body;
    body.src = bodySrc(f.body);
    const size = f.body === 'puddle' ? { w: standins.puddle.w, h: standins.puddle.h } : manifest[`snowman-${f.body}` as Piece];
    body.style.width = `${size.w * k}px`;
    body.style.height = `${size.h * k}px`;
    bodyWrap.style.left = `${(-size.w * k) / 2}px`;
    bodyWrap.style.top = `${-size.h * k}px`;
    bodyWrap.style.width = `${size.w * k}px`;
    bodyWrap.style.height = `${size.h * k}px`;
  }
  const sinkPx = f.sink * full;
  bodyWrap.style.transform = `translate(${f.dx * full}px, ${sinkPx}px) scale(${f.sx}, ${f.sy})`;
  // sinking: hide whatever has gone below the puddle's surface, a little above his feet
  body.style.clipPath = sinkPx > 0 ? `inset(0 0 ${sinkPx + Math.min(sinkPx, 0.05 * full)}px 0)` : '';
  body.classList.toggle('still', !!f.sink || f.body === 'puddle');
  spread.hidden = !(f.puddleScale && f.body !== 'puddle');
  if (f.puddleScale) spread.style.transform = `scale(${f.puddleScale}, ${f.puddleScale})`;
  shadow.hidden = f.body === 'puddle' || !!f.sink;

  if (f.hat) {
    hat.hidden = false;
    const src = f.hat.piece === 'puddle-hat' ? puddleHatUrl : f.hat.piece === 'hat-7' ? hat7Url : hat6Url;
    if (hat.getAttribute('src') !== src) hat.src = src;
    let h = hatHome(f.hat.piece);
    if (f.hat.fall !== undefined) {
      // part way from where it hung to where it will lie, keeping its own size
      const to = hatHome('puddle-hat');
      const p = f.hat.fall;
      const cxFrom = h.left + h.w / 2;
      const cyFrom = h.top + h.h / 2;
      const cxTo = to.left + to.w / 2;
      const cyTo = to.top + to.h / 2;
      h = { ...h, left: cxFrom + (cxTo - cxFrom) * p - h.w / 2, top: cyFrom + (cyTo - cyFrom) * p - h.h / 2 };
    }
    hat.style.left = `${h.left}px`;
    hat.style.top = `${h.top}px`;
    hat.style.width = `${h.w}px`;
    hat.style.height = `${h.h}px`;
    hat.style.transform = `translate(${f.hat.x * full}px, ${-f.hat.y * full}px) rotate(${f.hat.rot}deg) scale(1, ${f.hat.sy})`;
  } else hat.hidden = true;
  carrot.hidden = !f.carrot;
  if (f.carrot) carrot.style.transform = `translateY(${-f.carrot.y * full}px) rotate(${f.carrot.rot}deg) scale(${f.carrot.scale})`;
  lids.forEach((lid) => (lid.hidden = !(f.eyesClosed && f.body === 'puddle')));

  // the sun, its flare and the heat
  const heat = f.heat;
  const sunSize = Math.min(W * 0.3, H * 0.42) * (1 + 0.38 * heat);
  const sunLeft = W * (0.03 + 0.04 * heat) + f.sun.dx * sunSize;
  const sunTop = H * (0.05 + 0.05 * heat) + f.sun.dy * sunSize;
  sun.style.width = `${sunSize}px`;
  sun.style.height = `${sunSize}px`;
  sun.style.transform = `translate(${sunLeft}px, ${sunTop}px) scale(${f.sun.scale})`;
  if (f.sun.mood !== shownMood) {
    shownMood = f.sun.mood;
    sunImg.src = art(`sun-${f.sun.mood}` as Piece);
  }
  flare.hidden = !f.flare;
  if (f.flare) {
    const s = sunSize * f.flare.scale * f.sun.scale * 1.25;
    flare.style.width = flare.style.height = `${s}px`;
    flare.style.transform = `translate(${sunLeft + sunSize / 2 - s / 2}px, ${sunTop + sunSize / 2 - s / 2}px) rotate(${f.flare.rot}deg)`;
  }
  const th = parseFloat(thermo.style.height) || 0;
  const tw = parseFloat(thermo.style.getPropertyValue('--w')) || 24;
  mercury.style.height = `${th * heat + tw * 0.6}px`;

  // the beam: a zigzag band of heat from the sun to the top of his head
  beamSvg.style.display = f.beam ? '' : 'none';
  if (f.beam) {
    const x0 = sunLeft + sunSize * 0.62;
    const y0 = sunTop + sunSize * 0.62;
    const headH = typeof f.body === 'number' ? stageHeight(f.body) : 0.4;
    const x1 = cx + f.dx * full - 0.05 * full;
    const y1 = baseY - headH * full * 0.74;
    const ex = x0 + (x1 - x0) * f.beam;
    const ey = y0 + (y1 - y0) * f.beam;
    const len = Math.hypot(ex - x0, ey - y0);
    const nx = -(ey - y0) / len;
    const ny = (ex - x0) / len;
    const n = Math.max(3, Math.round((7 * f.beam)));
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i <= n; i++) {
      const p = i / n;
      const zig = (i % 2 ? 1 : -1) * 0.035 * full;
      const half = 0.03 * full * (1 - 0.5 * p);
      const px = x0 + (ex - x0) * p + nx * zig;
      const py = y0 + (ey - y0) * p + ny * zig;
      top.push(`${px + nx * half},${py + ny * half}`);
      bottom.unshift(`${px - nx * half},${py - ny * half}`);
    }
    beamPath.setAttribute('points', [...top, ...bottom].join(' '));
  }

  // particles
  const front = f.particles.filter((p) => p.kind !== 'heat');
  const back = f.particles.filter((p) => p.kind === 'heat');
  drawParticles(pool, particles, front);
  drawParticles(backPool, behind, back);

  heading.hidden = !f.heading;
  skipHint.hidden = !(state.playing?.kind === 'loss' && !f.heading && !params.has('at'));
}

const backPool: HTMLElement[] = [];
function drawParticles(pool: HTMLElement[], layer: HTMLElement, list: Particle[]) {
  while (pool.length < list.length) {
    const p = el('div', { class: 'mp-p' });
    pool.push(p);
    layer.append(p);
  }
  pool.forEach((node, i) => {
    const p: Particle | undefined = list[i];
    node.hidden = !p;
    if (!p) return;
    node.className = `mp-p ${p.kind}`;
    const size = p.size * full;
    node.style.width = `${size}px`;
    node.style.height = `${p.kind === 'heat' ? size * 1.6 : p.kind === 'steam' ? size * 0.46 : size}px`;
    node.style.opacity = String(p.opacity);
    node.style.transform = `translate(${cx + p.x * full - size / 2}px, ${baseY - p.y * full - size / 2}px) rotate(${p.rot}deg)`;
  });
}

// ---- the clock ----
let raf = 0;
let autoTimer = 0;
function idleFrame(): Frame {
  const n = state.misses;
  const stage = stageFor(n, limit());
  // any beat, long after it ended, is simply him standing at this stage
  const f = missFrame('flare', { from: stage, to: stage, heatFrom: n / limit(), heatTo: n / limit() }, 99_999);
  f.sun = { mood: 'smug', scale: 1, dx: 0, dy: 0 };
  return f;
}
function frameAt(t: number): Frame {
  const p = state.playing;
  if (!p) return idleFrame();
  if (p.kind === 'miss') {
    const f = missFrame(state.miss, p, Math.min(t, MISS_MS[state.miss]));
    if (t >= MISS_MS[state.miss] + 300) f.sun = { mood: 'smug', scale: 1, dx: 0, dy: 0 };
    return f;
  }
  return lossFrame(state.loss, { from: p.from, heatFrom: p.heatFrom }, t);
}
function tick(now: number) {
  const p = state.playing;
  if (!p) return;
  const t = now - p.t0;
  draw(frameAt(t));
  const done = p.kind === 'miss' && t > MISS_MS[state.miss] + 400;
  if (!done) raf = requestAnimationFrame(tick);
  else {
    state.playing = null;
    paint();
    draw(idleFrame());
    if (state.auto) autoTimer = window.setTimeout(() => miss(true), 650);
  }
}
function run(kind: 'miss' | 'loss', from: number, to: number) {
  cancelAnimationFrame(raf);
  const n = state.misses;
  state.playing = { kind, from, to, heatFrom: (n - 1) / limit(), heatTo: n / limit(), t0: performance.now() };
  if (kind === 'loss') heading.textContent = LOSS_HEADINGS[(Math.random() * LOSS_HEADINGS.length) | 0]!;
  paint();
  if (params.has('at')) return draw(frameAt(Number(params.get('at'))));
  if (state.reduced) {
    // reduced motion: no beat, just where it ends
    state.playing.t0 -= kind === 'loss' ? LOSS_MS[state.loss] + 200 : MISS_MS[state.miss] + 10_000;
  }
  raf = requestAnimationFrame(tick);
}
function miss(fromAuto = false) {
  if (!fromAuto) stopAuto();
  if (state.playing?.kind === 'loss' || state.misses >= limit()) return;
  if (state.playing) {
    // a tap while a beat is playing: finish it at once, then take the next miss
    state.playing = null;
  }
  const from = stageFor(state.misses, limit());
  state.misses++;
  const to = stageFor(state.misses, limit());
  if (state.misses >= limit()) {
    state.auto = false;
    run('loss', from, 8);
  } else run('miss', from, to);
}
function replay() {
  stopAuto();
  if (state.playing?.kind === 'loss' || state.misses >= limit()) {
    state.misses = limit() - 1;
    state.playing = null;
    return miss();
  }
  if (state.misses === 0) return miss();
  state.misses--;
  state.playing = null;
  miss();
}
function playRound() {
  startOver();
  state.auto = true;
  autoTimer = window.setTimeout(() => miss(true), 500);
}
function jumpToLoss() {
  stopAuto();
  cancelAnimationFrame(raf);
  state.playing = null;
  state.misses = limit() - 1;
  miss();
}
function stopAuto() {
  state.auto = false;
  clearTimeout(autoTimer);
}
function startOver() {
  stopAuto();
  cancelAnimationFrame(raf);
  state.playing = null;
  state.misses = 0;
  paint();
  draw(idleFrame());
}
function skip() {
  const p = state.playing;
  if (!p || params.has('at')) return;
  const end = p.kind === 'loss' ? LOSS_MS[state.loss] : MISS_MS[state.miss];
  const t = performance.now() - p.t0;
  if (t < end) p.t0 = performance.now() - end;
}

/** For the frame-strip script: show any moment of any option, with no clock running. */
(window as unknown as { meltAt: unknown }).meltAt = (o: { diff: Diff; miss: MissOption; loss: LossOption; misses: number; kind: 'miss' | 'loss'; t: number }) => {
  stopAuto();
  cancelAnimationFrame(raf);
  Object.assign(state, { diff: o.diff, miss: o.miss, loss: o.loss, misses: o.misses });
  const from = stageFor(o.misses - 1, limit());
  state.playing = { kind: o.kind, from, to: stageFor(o.misses, limit()), heatFrom: (o.misses - 1) / limit(), heatTo: o.misses / limit(), t0: 0 };
  heading.textContent = 'SPLOOSH!';
  paint();
  draw(frameAt(o.t));
};

// ---- start ----
paint();
new ResizeObserver(layout).observe(document.body);
document.fonts.ready.then(layout);
const everything: string[] = [
  ...Array.from({ length: 9 }, (_, i) => art(`snowman-${i}` as Piece)),
  art('sun-smug'),
  art('sun-gleeful'),
  art('cloud'),
  puddleBaseUrl,
  puddlePlainUrl,
  puddleHatUrl,
  puddleCarrotUrl,
  hat6Url,
  hat7Url,
];
for (const src of everything) {
  const img = new Image();
  img.src = src;
  stageImgs.set(src, img);
}
Promise.all([...stageImgs.values()].map((img) => img.decode().catch(() => undefined))).then(() => {
  layout();
  draw(idleFrame());
  const first = params.get('play');
  if (first === 'miss' || first === 'loss') {
    if (first === 'loss') state.misses = limit() - 1;
    miss();
  }
  root.dataset.ready = '1';
});
