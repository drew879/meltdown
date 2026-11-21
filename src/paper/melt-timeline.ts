// The melt, as data: what a wrong guess and the last wrong guess look like at
// every moment. Like celebration-timeline.ts, everything is a pure function of
// t, the milliseconds since the guess, so it can be tested without a browser,
// drawn at any moment and skipped to its end. Motion is stop-motion: every
// value is held and then jumps; nothing glides. Drew chose both from a preview
// page on 2026-11-21 (BRIEF.md, "Decisions from the melt preview"):
//
//   A wrong guess: the sun flares with a ring of rays behind it and heat
//   wiggles rise; he shivers, slumps through every stage in between, wobbles,
//   and two drops of sweat fly off.
//
//   The last wrong guess ("hat left hanging"): he melts out from under his
//   hat. It jumps, hangs in the air, looks down and drops into the puddle,
//   where it floats and bobs, the carrot bobs and the eyes blink up at you.
//
// Units: pixels of the cut art (the fresh snowman is 912 tall), x to the right
// of the middle of his feet and y up from them. melt.ts scales them to the screen.
import manifest from './art-manifest.json';

/** The loose pieces the melt draws, by the names they have (or will have) in public/art/. */
export const MELT_PIECES = [
  'puddle',
  'puddle-hat',
  'puddle-carrot',
  'puddle-eyes',
  'puddle-eyes-closed',
  'hat-6',
  'hat-7',
  'sun-flare',
  'heat-1',
  'heat-2',
  'drop',
] as const;
export type MeltPiece = (typeof MELT_PIECES)[number];
export type HatPiece = 'hat-6' | 'hat-7' | 'puddle-hat';

/** The fresh snowman's height: the yardstick for every distance here. */
export const FULL = manifest['snowman-0'].h;
/** How tall a melt stage stands. */
export const stageHeight = (stage: number) => manifest[`snowman-${stage}` as keyof typeof manifest].h;

/**
 * Where the middle of each loose piece lies when the puddle is at rest, as in the drawn stage 8
 * (measured by melt-standins/make-standins.mjs). The puddle is given by its bottom edge.
 * If the real puddle's outline differs, these are the numbers to nudge.
 */
export const REST = {
  puddle: { x: 0, bottom: 8 },
  hat: { x: 53.5, y: 285.5 },
  carrot: { x: -127, y: 142.5 },
  eyes: { x: -76, y: 196.5 },
} as const;
/** Where the middle of the hat sits on stages 6 and 7, the two stages a round can be lost from. */
export const HAT_ON = {
  'hat-6': { x: -70.5, y: 383 },
  'hat-7': { x: -58, y: 284.5 },
} as const;
/** The hat he was wearing on the stage before the last miss (6 on Hard, 7 on Easy and Normal). */
export const hatOf = (stage: number): 'hat-6' | 'hat-7' => (stage <= 6 ? 'hat-6' : 'hat-7');

export interface Particle {
  piece: 'heat-1' | 'heat-2' | 'drop';
  x: number;
  y: number;
  /** how wide it is drawn */
  size: number;
  rot: number;
  opacity: number;
  /** drawn behind him (the heat), so it never covers his face */
  behind: boolean;
}

export interface MeltFrame {
  /** the melt picture shown, or the bare puddle with its loose pieces */
  body: number | 'puddle';
  sx: number;
  sy: number;
  dx: number;
  /** the sun swells as it flares */
  sunScale: number;
  /** the ring of rays behind the sun: its width as a multiple of the swollen sun's, and its turn */
  flare: { scale: number; rot: number } | null;
  /** the hat, once it is its own piece: where its middle is, turned and squashed */
  hat: { piece: HatPiece; x: number; y: number; rot: number; sy: number } | null;
  /** the carrot in the puddle: where its middle is */
  carrot: { x: number; y: number; rot: number } | null;
  /** the puddle's eyes */
  eyes: 'open' | 'closed' | null;
  particles: Particle[];
}

// ---------------------------------------------------------------- helpers

/** The last key at or before t, from a list of [at, value]. */
function held<T>(t: number, keys: readonly (readonly [number, T])[]): T {
  let v = keys[0]![1];
  for (const [at, value] of keys) if (at <= t) v = value;
  return v;
}

/** 0 to 1 in held steps between two times, reaching exactly 1 on the last step. */
export function steps(t: number, from: number, to: number, n: number): number {
  if (t <= from) return 0;
  if (t >= to) return 1;
  return Math.min(1, Math.floor(((t - from) / (to - from)) * n) / (n - 1));
}

function standing(body: number | 'puddle'): MeltFrame {
  return { body, sx: 1, sy: 1, dx: 0, sunScale: 1, flare: null, hat: null, carrot: null, eyes: null, particles: [] };
}

const FLARE_MS = 360;

/** A shiver: a held left-right jitter between two times. */
const shiver = (t: number, from: number, to: number, amp: number, every: number) =>
  t >= from && t < to ? (Math.floor((t - from) / every) % 2 === 0 ? amp : -amp) : 0;

/** A drop thrown from (x0, y0) at (vx, vy) a second under gravity, drawn in held 60 ms steps; gone once it reaches the grass. */
function thrown(t: number, start: number, dur: number, p: { x0: number; y0: number; vx: number; vy: number; size: number; spin: number }): Particle | null {
  if (t < start || t >= start + dur) return null;
  const s = (Math.floor((t - start) / 60) * 60 + 30) / 1000;
  const y = p.y0 + p.vy * s - 0.5 * 3.2 * FULL * s * s;
  if (y < 0) return null;
  const left = 1 - (t - start) / dur;
  return { piece: 'drop', x: p.x0 + p.vx * s, y, size: p.size, rot: p.spin * s, opacity: Math.min(1, left * 4), behind: false };
}

/**
 * The sun's flare: a quick swell with the ring of rays behind it, in three held steps. `big` is for the last miss.
 * It is over at FLARE_MS, the moment he starts to go, so no two moves land a few milliseconds apart.
 */
function flare(f: MeltFrame, t: number, big: number) {
  const k = held(t, [
    [-Infinity, [1, 0, 0]],
    [0, [1.12, 1.3, 0]],
    [120, [1 + 0.22 * big, 1.44 + 0.15 * big, 12]],
    [240, [1 + 0.1 * big, 1.35, 20]],
    [FLARE_MS, [1, 0, 0]],
  ] as const);
  f.sunScale = k[0];
  f.flare = k[1] ? { scale: k[1], rot: k[2] } : null;
}

// ---------------------------------------------------------------- a wrong guess

const SLUMP_AT = FLARE_MS;
const WIGGLE_MS = 720;
const SWEAT_MS = 520;

/** The stages he passes through on the way from one to another, the last one included. */
export function slumpPath(from: number, to: number): number[] {
  const path: number[] = [];
  for (let s = from + 1; s <= to; s++) path.push(s);
  return path;
}
/** How long each stage on the way is held: quicker when there are more of them. */
const slumpStep = (count: number) => Math.min(160, 480 / Math.max(1, count));
/** When he has landed on the new stage and the wobble begins. */
export const settledAt = (from: number, to: number) => SLUMP_AT + slumpPath(from, to).length * slumpStep(to - from);
/** How long the whole beat lasts: until the last wiggle has risen and the sweat has landed. */
export const missMs = (from: number, to: number) => Math.max(400 + WIGGLE_MS, settledAt(from, to) + SWEAT_MS);

export function missFrame(from: number, to: number, t: number): MeltFrame {
  const f = standing(from);
  flare(f, t, 1);
  f.dx = shiver(t, 60, SLUMP_AT, 0.012 * FULL, 60);

  // slump through each stage on the way, with a small squash as each one lands
  const path = slumpPath(from, to);
  const step = slumpStep(path.length);
  const settled = settledAt(from, to);
  if (t >= SLUMP_AT && path.length) {
    const i = Math.min(path.length - 1, Math.floor((t - SLUMP_AT) / step));
    f.body = path[i]!;
    if (t - SLUMP_AT - i * step < step / 2) [f.sx, f.sy] = [1.06, 0.93];
  }
  // then a wobble as he settles
  if (t >= settled) {
    [f.sx, f.sy] = held(t, [
      [settled, [1.05, 0.95]],
      [settled + 120, [0.97, 1.03]],
      [settled + 240, [1.01, 0.99]],
      [settled + 340, [1, 1]],
    ] as const);
  }

  // three heat wiggles rise: one each side of him and one off the top of his hat
  const h = typeof f.body === 'number' ? stageHeight(f.body) : 0;
  for (let i = 0; i < 3; i++) {
    const start = 180 + i * 110;
    if (t < start || t >= start + WIGGLE_MS) continue;
    const p = steps(t, start, start + WIGGLE_MS, 6);
    const beside = i < 2;
    f.particles.push({
      piece: i === 1 ? 'heat-2' : 'heat-1',
      x: beside ? [-0.36, 0.38][i]! * Math.max(0.75 * FULL, h) : -0.12 * FULL,
      y: (beside ? h * 0.4 : h + 0.02 * FULL) + 0.3 * FULL * p,
      size: 0.15 * FULL,
      rot: 0,
      opacity: p < 0.2 ? 0.6 : p > 0.8 ? 0.5 : 1,
      behind: true,
    });
  }
  // two drops of sweat fly off his head as he settles
  const head = stageHeight(to) * 0.82;
  for (const side of [-1, 1]) {
    const drop = thrown(t, settled, SWEAT_MS, { x0: 0.12 * FULL * side, y0: head, vx: 0.42 * FULL * side, vy: 0.8 * FULL, size: 0.085 * FULL, spin: 140 * side });
    if (drop) f.particles.push(drop);
  }
  return f;
}

// ---------------------------------------------------------------- the last wrong guess

/** When the loss has played out and the puddle is at rest: the heading comes up then. A tap skips to here. */
export const LOSS_MS = 2300;
const DROP = FLARE_MS;
const FALL = 1500;
const LAND = 1730;
/** How far above his head the hat jumps and hangs. */
const HANG = 0.3 * FULL;

/** The puddle at rest: the hat floats and bobs, the carrot bobs, the eyes blink. `t` is the time at rest; null is the still picture. */
export function restFrame(t: number | null): MeltFrame {
  const f = standing('puddle');
  const hatUp = t !== null && Math.floor(t / 650) % 2 === 1;
  f.hat = { piece: 'puddle-hat', x: REST.hat.x, y: REST.hat.y + (hatUp ? 0.012 * FULL : 0), rot: t === null ? 0 : hatUp ? -2.5 : 1.5, sy: 1 };
  const carrotUp = t !== null && Math.floor((t + 325) / 650) % 2 === 1;
  f.carrot = { x: REST.carrot.x, y: REST.carrot.y + (carrotUp ? 0.01 * FULL : 0), rot: t === null ? 0 : carrotUp ? 4 : -2 };
  // a blink, then a double blink, every 5.2 s (eight bobs, so the blinks and the bobs never land a few milliseconds apart)
  const c = t === null ? 0 : t % 5200;
  f.eyes = (c >= 700 && c < 830) || (c >= 3120 && c < 3250) || (c >= 3360 && c < 3490) ? 'closed' : 'open';
  return f;
}

/** Drops thrown out of the puddle when something lands in it. */
function splash(f: MeltFrame, t: number, at: number, n: number, spread: number, power: number) {
  for (let i = 0; i < n; i++) {
    const a = -1 + (2 * i) / Math.max(1, n - 1);
    const drop = thrown(t, at, 560, {
      x0: a * 0.16 * FULL * spread,
      y0: 0.05 * FULL,
      vx: a * 0.55 * FULL * spread,
      vy: (0.9 + 0.45 * (1 - Math.abs(a))) * FULL * power,
      size: (0.075 + 0.025 * (i % 2)) * FULL,
      spin: a * 160,
    });
    if (drop) f.particles.push(drop);
  }
}

/** `from` is the stage he was at before the last miss: 6 on Hard, 7 on Easy and Normal. */
export function lossFrame(from: number, t: number): MeltFrame {
  if (t >= LOSS_MS) return restFrame(t - LOSS_MS);
  const f = standing(from);
  flare(f, t, 1.5);
  f.dx = shiver(t, 0, DROP, 0.012 * FULL, 60);
  if (t < DROP) return f;

  // gone in a blink: the puddle is all that is left under the hat
  f.body = 'puddle';
  [f.sx, f.sy] = held(t, [
    [DROP, [1.22, 0.7]],
    [DROP + 100, [0.94, 1.08]],
    [DROP + 200, [1, 1]],
  ] as const);
  splash(f, t, DROP, 6, 1, 0.8);
  f.carrot = { x: REST.carrot.x, y: REST.carrot.y, rot: 0 };
  f.eyes = 'open';
  const piece = hatOf(from);
  const on = HAT_ON[piece];

  if (t < FALL) {
    // the hat jumps up off him in surprise and hangs there, well clear of the puddle, then looks down
    const up = held(t, [
      [DROP, 0.12 * FULL],
      [DROP + 100, 0.26 * FULL],
      [DROP + 200, HANG + 0.03 * FULL],
      [DROP + 300, HANG],
    ] as const);
    const look = held(t, [
      [DROP, 0],
      [800, -9],
      [1000, 9],
      [1200, -4],
      [1320, 0],
    ] as const);
    f.hat = { piece, x: on.x, y: on.y + up, rot: look, sy: 1 };
    // the eyes squeeze shut at the splat, open, look up at the hat and blink once
    if ((t >= DROP && t < DROP + 300) || (t >= 1080 && t < 1200)) f.eyes = 'closed';
    return f;
  }
  if (t < LAND) {
    // it falls, faster and faster, from where it hung to where it will lie
    const p = held(t, [
      [FALL, 0.12],
      [FALL + 80, 0.35],
      [FALL + 160, 0.68],
    ] as const);
    f.hat = { piece, x: on.x + (REST.hat.x - on.x) * p, y: on.y + HANG + (REST.hat.y - on.y - HANG) * p, rot: p * 14, sy: 1 };
    return f;
  }
  // plop: the hat lands with a squash, water flies, the carrot bobs and the eyes flinch
  const sy = held(t, [
    [LAND, 0.82],
    [LAND + 120, 1.06],
    [LAND + 240, 1],
  ] as const);
  f.hat = { piece: 'puddle-hat', x: REST.hat.x, y: REST.hat.y, rot: 0, sy };
  splash(f, t, LAND, 5, 0.7, 0.7);
  const bob = held(t, [
    [LAND, -0.012 * FULL],
    [LAND + 120, 0.01 * FULL],
    [LAND + 240, 0],
  ] as const);
  f.carrot = { x: REST.carrot.x, y: REST.carrot.y + bob, rot: (bob / FULL) * 300 };
  if (t < LAND + 160) f.eyes = 'closed';
  return f;
}
