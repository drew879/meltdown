// A mock-up page for the win celebration. It plays the round 4 poses in the
// real yard, with the cloud and snow, so Drew can pick between the backflip
// and the dance. It is not part of the game and the game does not load it.
// Delete it (with celebrate.html and celebrate.css) when the celebration is
// built for real in Phase 2.
//
// Everything is drawn from one clock: render(t) says where every piece is at
// time t milliseconds after the win. Motion is stop-motion, held poses that
// step and never glide, so the page can also be frozen at any moment with
// ?play=backflip&at=1000 for screenshots. It ignores prefers-reduced-motion
// on purpose: Drew asked to see the motion, and presses a button for it.
//
//   ?play=backflip|dance   start playing at once
//   &snow=0                without the cloud and snow
//   &at=1200               freeze at 1200 ms
//   &slow=1                half speed
import '../paper/paper.css';
import '../app/screens.css';
import './celebrate.css';
import { el } from '../app/dom';
import { art, manifest, type Piece } from '../paper/art';
import { createYard, placeYard } from '../paper/yard';

type Kind = 'backflip' | 'dance';

/** One held pose: from `at` ms until the next one. lift is a share of the snowman's height. */
interface Key {
  at: number;
  piece: Piece;
  lift?: number;
  dx?: number;
  rot?: number;
  sx?: number;
  sy?: number;
  /** turn about his middle rather than his feet (for the flip) */
  centre?: boolean;
}

const FRESH: Key = { at: 0, piece: 'snowman-0' };

/** crouch, jump, flip, land, finish with arms up */
const BACKFLIP: Key[] = [
  FRESH,
  { at: 350, piece: 'win-backflip-1' },
  { at: 800, piece: 'win-backflip-2', lift: 0.26, rot: 32, centre: true },
  { at: 950, piece: 'win-backflip-2', lift: 0.5, rot: 0, centre: true },
  { at: 1100, piece: 'win-backflip-2', lift: 0.46, rot: -24, centre: true },
  { at: 1250, piece: 'win-backflip-2', lift: 0.22, rot: -42, centre: true },
  { at: 1400, piece: 'win-backflip-3' },
  { at: 1800, piece: 'win-backflip-4', lift: 0.05, sx: 0.96, sy: 1.05 },
  { at: 1950, piece: 'win-backflip-4' },
];
for (let at = 2250; at < 4200; at += 300) {
  BACKFLIP.push({ at, piece: 'win-backflip-4', lift: (at - 2250) % 600 === 0 ? 0.015 : 0 });
}

/** sway left and right for eight beats, tip the hat, then jazz hands */
const DANCE: Key[] = [FRESH];
for (let i = 0; i < 8; i++) {
  const left = i % 2 === 0;
  DANCE.push({ at: 350 + i * 300, piece: left ? 'win-dance-1' : 'win-dance-2', lift: left ? 0.02 : 0, rot: left ? -1.5 : 1.5 });
}
DANCE.push({ at: 2750, piece: 'win-dance-3' });
DANCE.push({ at: 3650, piece: 'win-dance-4', lift: 0.05, sx: 0.96, sy: 1.05 });
DANCE.push({ at: 3800, piece: 'win-dance-4' });
for (let at = 4100; at < 5400; at += 300) {
  DANCE.push({ at, piece: 'win-dance-4', lift: (at - 4100) % 600 === 0 ? 0.015 : 0 });
}

const POSES: Piece[] = [
  'snowman-0',
  'win-backflip-1',
  'win-backflip-2',
  'win-backflip-3',
  'win-backflip-4',
  'win-dance-1',
  'win-dance-2',
  'win-dance-3',
  'win-dance-4',
];
const FLAKES: Piece[] = ['flake-1', 'flake-2', 'flake-3', 'flake-4', 'flake-5', 'flake-6'];

// the cloud rolls in over the sun, then snow falls
const CLOUD_FROM = 400;
const CLOUD_TO = 1800;
const SNOW_FROM = 1400;
const SNOW_UNTIL = 6200;
const FLAKE_COUNT = 30;
const FALL_STEPS = 14;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(11);
const flakeSpecs = Array.from({ length: FLAKE_COUNT }, (_, i) => ({
  start: SNOW_FROM + (i * (SNOW_UNTIL - SNOW_FROM)) / FLAKE_COUNT + rand() * 120,
  duration: 2400 + rand() * 1400,
  across: rand(), // where under the cloud it starts, 0 to 1
  drift: 0.04 + rand() * 0.16, // blown to the right, in screen widths
  size: 0.05 + rand() * 0.05, // in screen widths
  turn: (rand() < 0.5 ? -1 : 1) * (90 + rand() * 150),
  turn0: rand() * 60,
  sway: 0.012 + rand() * 0.02,
  phase: rand() * 6,
  land: rand() * 0.14, // how far above the ground it fades, in snowman heights
  piece: FLAKES[i % FLAKES.length]!,
}));

/** A step in a held-pose animation: the value stays put, then jumps. */
const stepped = (p: number, steps: number) => Math.min(1, Math.floor(p * steps) / (steps - 1));

function start() {
  const root = document.getElementById('pp') as HTMLElement;
  const params = new URLSearchParams(location.search);

  // ---- the pieces ----
  const yard = createYard();
  const sun = el('img', { class: 'cp-sun', alt: '', src: art('sun-smug') });
  const cloud = el('img', { class: 'cp-cloud', alt: '', src: art('cloud'), hidden: true });
  const ground = el('div', { class: 'cp-ground' });
  const actor = el('div', { class: 'cp-actor' });
  const poseImgs = new Map<Piece, HTMLImageElement>();
  for (const piece of POSES) {
    const img = el('img', { alt: '', src: art(piece), hidden: piece !== 'snowman-0' });
    poseImgs.set(piece, img);
    actor.append(img);
  }
  const flakeImgs = flakeSpecs.map((f) => el('img', { class: 'cp-flake', alt: '', src: art(f.piece), hidden: true }));
  // two flakes in three fall behind him, so the snow never buries his face
  const behind = flakeImgs.filter((_, i) => i % 3 !== 0);
  const front = flakeImgs.filter((_, i) => i % 3 === 0);
  const scene = el('section', { class: 'cp-scene', 'aria-label': 'The snowman in the yard' }, sun, cloud, ...behind, ground, actor, ...front);

  // ---- the controls ----
  const state = { kind: null as Kind | null, snow: params.get('snow') !== '0', slow: params.get('slow') === '1', t0: 0 };
  const go = (kind: Kind, label: string) =>
    el('button', { class: 'pp-btn go', type: 'button', 'aria-pressed': 'false', onclick: () => play(kind) }, label);
  const backflip = go('backflip', 'Backflip');
  const dance = go('dance', 'Dance');
  const snowBtn = el('button', { class: 'pp-btn alt', type: 'button', onclick: () => toggle('snow') });
  const slowBtn = el('button', { class: 'pp-btn alt', type: 'button', onclick: () => toggle('slow') });
  const panel = el(
    'section',
    { class: 'cp-panel', 'aria-label': 'Choose a celebration' },
    el('p', { class: 'cp-label' }, 'Mock-up: the win celebration'),
    el('div', { class: 'cp-row' }, backflip, dance),
    el('div', { class: 'cp-row' }, snowBtn, slowBtn),
    el('p', { class: 'cp-hint' }, 'Tap a celebration to play it. Tap again to replay.'),
  );
  root.append(yard, scene, panel);

  function paintButtons() {
    backflip.setAttribute('aria-pressed', String(state.kind === 'backflip'));
    dance.setAttribute('aria-pressed', String(state.kind === 'dance'));
    snowBtn.setAttribute('aria-pressed', String(state.snow));
    snowBtn.textContent = `Cloud and snow: ${state.snow ? 'on' : 'off'}`;
    slowBtn.setAttribute('aria-pressed', String(state.slow));
    slowBtn.textContent = `Slow motion: ${state.slow ? 'on' : 'off'}`;
  }
  function toggle(which: 'snow' | 'slow') {
    // keep the clock steady when the speed changes mid-way
    const now = performance.now();
    if (which === 'slow' && state.kind) state.t0 = now - (now - state.t0) * (state.slow ? 0.5 : 2);
    state[which] = !state[which];
    paintButtons();
    kick();
  }

  // ---- layout, worked out the way the play screen does it ----
  let full = 0;
  let k = 0;
  let baseY = 0;
  let sunSize = 0;
  let cloudW = 0;
  let cloudH = 0;
  let cloudLeft = 0;
  let cloudTop = 0;
  let W = 0;
  function layout() {
    const box = scene.getBoundingClientRect();
    W = box.width;
    full = Math.min(box.height * 0.82, box.width * 0.8);
    k = full / manifest['snowman-0'].h;
    baseY = box.height * 0.985;
    for (const [piece, img] of poseImgs) {
      const m = manifest[piece];
      img.style.width = `${m.w * k}px`;
      img.style.height = `${m.h * k}px`;
      img.style.left = `${(-m.w * k) / 2}px`;
      img.style.top = `${-m.h * k}px`;
    }
    actor.style.left = `${box.width * 0.48}px`;
    actor.style.top = `${baseY}px`;
    ground.style.width = `${full * 0.7}px`;
    ground.style.left = `${box.width * 0.48 - full * 0.35}px`;
    ground.style.top = `${baseY - 8}px`;

    sunSize = Math.min(box.width * 0.3, box.height * 0.42);
    sun.style.width = `${sunSize}px`;
    sun.style.left = `${box.width * 0.03}px`;
    sun.style.top = `${box.height * 0.05}px`;

    // wide enough that its big middle puff (just over half way along, and as wide as the
    // sun) sits right over the sun
    cloudW = box.width * 1.15;
    cloudH = (cloudW * manifest.cloud.h) / manifest.cloud.w;
    cloudLeft = box.width * 0.03 + sunSize / 2 - cloudW * 0.52;
    cloudTop = box.height * 0.05 + sunSize / 2 - cloudH * 0.52;
    cloud.style.width = `${cloudW}px`;
    cloud.style.height = `${cloudH}px`;

    placeYard(yard, box.top + baseY - full * 0.4);
    render(lastT);
  }

  // ---- one frame: where is everything at t ms? ----
  let lastT = -1;
  let shown: Piece = 'snowman-0';
  let sunMood = 'smug';
  function render(t: number) {
    lastT = t;
    const keys = state.kind === 'dance' ? DANCE : state.kind === 'backflip' ? BACKFLIP : [FRESH];
    let key = keys[0]!;
    if (t >= 0) for (const candidate of keys) if (candidate.at <= t) key = candidate;
    if (key.piece !== shown) {
      poseImgs.get(shown)!.hidden = true;
      poseImgs.get(key.piece)!.hidden = false;
      shown = key.piece;
    }
    const lift = (key.lift ?? 0) * full;
    const m = manifest[key.piece];
    actor.style.transformOrigin = key.centre ? `0px ${-(m.h * k) / 2}px` : '0px 0px';
    actor.style.transform = `translate(${(key.dx ?? 0) * full}px, ${-lift}px) rotate(${key.rot ?? 0}deg) scale(${key.sx ?? 1}, ${key.sy ?? 1})`;
    // the shadow on the grass shrinks and fades as he rises
    const up = Math.min(1, (key.lift ?? 0) / 0.5);
    ground.style.transform = `scale(${1 - 0.5 * up}, ${1 - 0.4 * up})`;
    ground.style.opacity = String(1 - 0.6 * up);

    // the sun sulks as soon as he wins
    const mood = state.kind && t >= 0 ? 'dismayed' : 'smug';
    if (mood !== sunMood) {
      sunMood = mood;
      sun.src = art(`sun-${mood}` as Piece);
    }

    // the cloud rolls in over the sun
    const cloudOn = state.snow && state.kind !== null && t >= CLOUD_FROM;
    cloud.hidden = !cloudOn;
    if (cloudOn) {
      const q = stepped(Math.min(1, (t - CLOUD_FROM) / (CLOUD_TO - CLOUD_FROM)), 8);
      const bob = t > CLOUD_TO ? Math.floor(t / 600) % 2 === 0 ? 0 : 3 : 0;
      cloud.style.transform = `translate(${cloudLeft + (1 - q) * (W - cloudLeft)}px, ${cloudTop + bob}px)`;
    }

    // snow
    flakeSpecs.forEach((f, i) => {
      const img = flakeImgs[i]!;
      const p = (t - f.start) / f.duration;
      const on = state.snow && state.kind !== null && p >= 0 && p <= 1;
      img.hidden = !on;
      if (!on) return;
      const q = stepped(p, FALL_STEPS);
      const size = f.size * W;
      img.style.width = `${size}px`;
      const x0 = 0.03 * W + f.across * (cloudLeft + cloudW * 0.88 - 0.03 * W);
      const y0 = cloudTop + cloudH * 0.8;
      const y1 = baseY - f.land * full - size;
      const x = x0 + f.drift * W * q + Math.sin(f.phase + q * 7) * f.sway * W;
      const y = y0 + (y1 - y0) * q;
      const fade = q < 0.1 ? q / 0.1 : q > 0.85 ? (1 - q) / 0.15 : 1;
      img.style.opacity = String(Math.max(0, fade));
      img.style.transform = `translate(${x}px, ${y}px) rotate(${f.turn0 + f.turn * q}deg)`;
    });
  }

  // ---- the clock ----
  let raf = 0;
  const speed = () => (state.slow ? 0.5 : 1);
  function endOf(): number {
    const keys = state.kind === 'dance' ? DANCE : BACKFLIP;
    const poses = keys[keys.length - 1]!.at + 300;
    return state.snow ? Math.max(poses, SNOW_UNTIL + 3800) : poses;
  }
  function frame(now: number) {
    const t = (now - state.t0) * speed();
    render(Math.min(t, endOf()));
    if (t < endOf()) raf = requestAnimationFrame(frame);
  }
  function kick() {
    cancelAnimationFrame(raf);
    if (state.kind && !params.has('at')) raf = requestAnimationFrame(frame);
    else render(params.has('at') ? Number(params.get('at')) : -1);
  }
  function play(kind: Kind) {
    state.kind = kind;
    state.t0 = performance.now();
    paintButtons();
    kick();
  }

  paintButtons();
  new ResizeObserver(layout).observe(document.body);
  document.fonts.ready.then(layout);

  // wait for every picture, so no pose flickers the first time it appears
  const everything = [...poseImgs.values(), sun, cloud, ...flakeImgs];
  const ready = Promise.all(everything.map((img) => img.decode().catch(() => undefined)));
  const first = params.get('play');
  ready.then(() => {
    layout();
    if (first === 'backflip' || first === 'dance') play(first);
  });
}

start();
