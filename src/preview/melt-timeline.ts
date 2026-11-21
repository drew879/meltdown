// The melt options for Drew to choose from (Phase 2): three beats for a wrong
// guess and three loss sequences. Like the win celebration's timeline, each is
// a pure function of t, the milliseconds since the guess, so any moment can be
// drawn, frozen for a screenshot or skipped to the end. Motion is stop-motion:
// every value is held and then jumps; nothing glides.
//
// This is a preview, not the game: melt.html draws it. When Drew picks, the
// chosen beat and loss move into src/paper/ beside celebration-timeline.ts.
//
// Units: x and y are in fresh-snowman heights ("full"), measured from the
// middle of his feet, y up. The sun's offsets are in sun widths.
import manifest from '../paper/art-manifest.json';

export type MissOption = 'flare' | 'slump' | 'beam';
export type LossOption = 'sploosh' | 'hat' | 'sink';

export const MISS_OPTIONS: { id: MissOption; name: string; blurb: string }[] = [
  { id: 'flare', name: 'A. Flare', blurb: 'The sun flares, heat wiggles rise, he squashes into the next stage and sweat flies off.' },
  { id: 'slump', name: 'B. Slump', blurb: 'The sun hops with glee, he shivers, then slumps through every stage in between. No new art.' },
  { id: 'beam', name: 'C. Sunbeam', blurb: 'The sun leans in and zaps him with a beam; he flinches, steam puffs off his head.' },
];
export const LOSS_OPTIONS: { id: LossOption; name: string; blurb: string }[] = [
  { id: 'sploosh', name: 'A. Sploosh', blurb: 'He trembles, drops and goes SPLAT: water flies, the hat and carrot pop up and land.' },
  { id: 'hat', name: 'B. Hat left hanging', blurb: 'He melts out from under his hat. It hangs in the air, looks down, then drops in.' },
  { id: 'sink', name: 'C. Sink and bloop', blurb: 'He sinks into the puddle. Bubbles. Then the hat, the carrot and his eyes bloop back up.' },
];

/** The stage shown after `misses` of `limit` misses (BRIEF.md, 2026-11-19). */
export const stageFor = (misses: number, limit: number) => Math.round((misses * 8) / limit);

const FULL = manifest['snowman-0'].h;
/** How tall a stage stands, in full heights. */
export const stageHeight = (stage: number) => manifest[`snowman-${stage}` as keyof typeof manifest].h / FULL;

export type ParticleKind = 'sweat' | 'splash' | 'heat' | 'steam' | 'bubble';
export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  /** in full heights */
  size: number;
  rot: number;
  opacity: number;
}

export interface Frame {
  /** the melt picture shown; 'puddle' is stage 8 with the hat and carrot as separate pieces */
  body: number | 'puddle';
  sx: number;
  sy: number;
  dx: number;
  /** how far he has sunk into the ground, in full heights (clipped at the puddle line) */
  sink: number;
  sun: { mood: 'smug' | 'gleeful'; scale: number; dx: number; dy: number };
  /** the flare ring behind the sun: its size as a share of the sun, or null */
  flare: { scale: number; rot: number } | null;
  /** the thermometer and the sun's size: 0 cold to 1 at the limit */
  heat: number;
  /** a beam from the sun to the top of his head: how far it reaches, 0 to 1, or null */
  beam: number | null;
  /** the hat, when it is its own piece: which picture, how far from where it sits in that picture (full heights), and turned */
  hat: { piece: 'hat-6' | 'hat-7' | 'puddle-hat'; x: number; y: number; rot: number; sy: number; fall?: number } | null;
  /** the carrot, when it is its own piece: offset from where it lies in the puddle */
  carrot: { y: number; rot: number; scale: number } | null;
  eyesClosed: boolean;
  particles: Particle[];
  /** the loss heading is up */
  heading: boolean;
  /** for the sink: how far the new puddle has spread under him, 0 to 1 (undefined: not drawn separately) */
  puddleScale?: number;
}

export interface MissInput {
  from: number;
  to: number;
  heatFrom: number;
  heatTo: number;
}

// ---------------------------------------------------------------- helpers

/** The last key at or before t, from a list of [at, value]. */
function held<T>(t: number, keys: readonly (readonly [number, T])[]): T {
  let v = keys[0]![1];
  for (const [at, value] of keys) if (at <= t) v = value;
  return v;
}

/** 0 to 1 in held steps between two times, reaching 1 on the last step. */
export function steps(t: number, from: number, to: number, n: number): number {
  if (t <= from) return 0;
  if (t >= to) return 1;
  return Math.min(1, Math.floor(((t - from) / (to - from)) * n) / (n - 1));
}

/** Snaps t down to the frame it falls in, so free motion still moves in held frames (about 12 a second). */
const onTwos = (t: number, frame = 84) => Math.floor(t / frame) * frame;

const SUN_REST = { mood: 'smug' as const, scale: 1, dx: 0, dy: 0 };

function base(stage: number | 'puddle', heat: number): Frame {
  return {
    body: stage,
    sx: 1,
    sy: 1,
    dx: 0,
    sink: 0,
    sun: { ...SUN_REST },
    flare: null,
    heat,
    beam: null,
    hat: null,
    carrot: null,
    eyesClosed: false,
    particles: [],
    heading: false,
  };
}

/** The squash, swap and spring back the game already uses, starting at `at`. Returns the stage and scale. */
function popInto(t: number, at: number, from: number | 'puddle', to: number | 'puddle') {
  const k = held(t, [
    [-Infinity, [from, 1, 1]],
    [at, [from, 1.07, 0.9]],
    [at + 85, [from, 1.1, 0.86]],
    [at + 170, [to, 0.93, 1.09]],
    [at + 270, [to, 1.04, 0.96]],
    [at + 370, [to, 1, 1]],
  ] as const);
  return { body: k[0], sx: k[1], sy: k[2] };
}

/** A shiver: a held left-right jitter of `amp` full heights between two times. */
const shiver = (t: number, from: number, to: number, amp: number, every = 60) =>
  t >= from && t < to ? (Math.floor((t - from) / every) % 2 === 0 ? amp : -amp) : 0;

/** A thrown particle: from (x0, y0) with velocity (vx, vy) per second under gravity g, drawn in held steps. */
function thrown(
  kind: ParticleKind,
  t: number,
  start: number,
  dur: number,
  p: { x0: number; y0: number; vx: number; vy: number; g?: number; size: number; spin?: number; floor?: number },
): Particle | null {
  if (t < start || t > start + dur) return null;
  const s = (onTwos(t - start, 60) + 30) / 1000;
  const y = p.y0 + p.vy * s - 0.5 * (p.g ?? 3.2) * s * s;
  if (p.floor !== undefined && y < p.floor) return null;
  const left = 1 - (t - start) / dur;
  return { kind, x: p.x0 + p.vx * s, y, size: p.size, rot: (p.spin ?? 0) * s, opacity: Math.min(1, left * 4) };
}

/** The sun's flare, used by every option: a quick swell with the flare ring behind it, held in steps. */
function flareSun(f: Frame, t: number, at: number, big = 1) {
  const k = held(t, [
    [-Infinity, [1, 0, 0]],
    [at, [1.12, 1.05, 0]],
    [at + 120, [1 + 0.22 * big, 1.15 + 0.12 * big, 12]],
    [at + 260, [1 + 0.1 * big, 1.08, 20]],
    [at + 420, [1, 0, 0]],
  ] as const);
  f.sun.scale = k[0];
  f.flare = k[1] ? { scale: k[1], rot: k[2] } : null;
  if (t >= at) f.sun.mood = 'gleeful';
}

const heatAt = (t: number, m: { heatFrom: number; heatTo: number }, from = 150, to = 450) =>
  m.heatFrom + (m.heatTo - m.heatFrom) * steps(t, from, to, 4);

// ---------------------------------------------------------------- the miss beats

export const MISS_MS: Record<MissOption, number> = { flare: 1300, slump: 1300, beam: 1500 };

export function missFrame(option: MissOption, m: MissInput, t: number): Frame {
  if (option === 'flare') return flareBeat(m, t);
  if (option === 'slump') return slumpBeat(m, t);
  return beamBeat(m, t);
}

/** A. The sun flares, heat wiggles rise off him, he squashes into the next stage and two drops of sweat fly. */
function flareBeat(m: MissInput, t: number): Frame {
  const f = base(m.from, heatAt(t, m));
  flareSun(f, t, 0);
  Object.assign(f, popInto(t, 470, m.from, m.to));
  const h = stageHeight(t < 640 ? m.from : m.to);
  // three heat wiggles rise around him
  for (let i = 0; i < 3; i++) {
    const start = 180 + i * 110;
    const p = steps(t, start, start + 720, 6);
    if (t < start || t > start + 720) continue;
    f.particles.push({
      kind: 'heat',
      x: [-0.36, 0.38, -0.12][i]! * (i === 2 ? 1 : Math.max(0.75, h)),
      y: (i === 2 ? h + 0.02 : h * 0.4) + 0.3 * p,
      size: 0.15,
      rot: 0,
      opacity: p < 0.2 ? 0.6 : p > 0.8 ? 0.5 : 1,
    });
  }
  // two drops of sweat fly off as he lands in the new stage
  const head = stageHeight(m.to) * 0.82;
  for (const side of [-1, 1]) {
    const p = thrown('sweat', t, 640, 520, { x0: 0.12 * side, y0: head, vx: 0.42 * side, vy: 0.8, size: 0.085, spin: 140 * side, floor: 0.02 });
    if (p) f.particles.push(p);
  }
  if (t > 1100) f.sun.mood = 'gleeful';
  return f;
}

/** B. The sun hops with glee, he shivers, then slumps through every stage in between (existing art only). */
function slumpBeat(m: MissInput, t: number): Frame {
  const f = base(m.from, heatAt(t, m));
  f.sun.mood = 'gleeful';
  f.sun.dy = held(t, [
    [-Infinity, 0],
    [0, -0.1],
    [140, 0],
    [260, -0.05],
    [360, 0],
  ] as const);
  f.sun.scale = held(t, [
    [-Infinity, 1],
    [0, 1.1],
    [360, 1],
  ] as const);
  f.dx = shiver(t, 60, 360, 0.012);
  // slump through each stage on the way, a small squash as each lands
  const path: number[] = [];
  for (let s = m.from + 1; s <= m.to; s++) path.push(s);
  const STEP = Math.min(160, 480 / path.length);
  const start = 360;
  if (t >= start) {
    const i = Math.min(path.length - 1, Math.floor((t - start) / STEP));
    f.body = path[i]!;
    const into = t - start - i * STEP;
    if (into < STEP * 0.45) {
      f.sx = 1.06;
      f.sy = 0.93;
    }
  }
  const settled = start + path.length * STEP;
  const wob = held(t, [
    [-Infinity, [1, 1]],
    [settled, [1.05, 0.95]],
    [settled + 120, [0.97, 1.03]],
    [settled + 240, [1.01, 0.99]],
    [settled + 340, [1, 1]],
  ] as const);
  if (t >= settled) {
    f.sx = wob[0];
    f.sy = wob[1];
  }
  // a drip runs down his side and drops into the grass
  const h = stageHeight(m.to);
  const drip = steps(t, settled, settled + 500, 6);
  if (t >= settled && t < settled + 560)
    f.particles.push({ kind: 'sweat', x: 0.2 * (stageHeight(m.to) > 0.6 ? 1 : 1.3), y: h * (0.62 - 0.55 * drip), size: 0.08, rot: 0, opacity: drip > 0.85 ? 0.5 : 1 });
  return f;
}

/** C. The sun leans in and zaps him with a beam; he flinches, steam puffs off his head, and he drops a stage. */
function beamBeat(m: MissInput, t: number): Frame {
  const f = base(m.from, heatAt(t, m, 400, 700));
  const lean = held(t, [
    [-Infinity, 0],
    [0, 0.5],
    [100, 1],
    [1000, 0.5],
    [1100, 0],
  ] as const);
  f.sun = { mood: t >= 0 && t < 1300 ? 'gleeful' : 'smug', scale: 1 + 0.08 * lean, dx: 0.22 * lean, dy: 0.1 * lean };
  if (t >= 200 && t < 820) {
    f.beam = held(t, [
      [200, 0.34],
      [270, 0.67],
      [340, 1],
    ] as const);
    f.flare = { scale: 1.12 + (Math.floor(t / 70) % 2) * 0.06, rot: Math.floor(t / 70) * 7 };
  }
  f.dx = shiver(t, 340, 640, 0.016, 50);
  Object.assign(f, popInto(t, 640, m.from, m.to));
  if (t >= 340 && t < 640) f.sy = 0.97;
  // steam puffs rise off his head
  const head = stageHeight(t < 810 ? m.from : m.to);
  for (let i = 0; i < 3; i++) {
    const start = 420 + i * 160;
    if (t < start || t >= start + 700) continue;
    const p = steps(t, start, start + 700, 7);
    f.particles.push({
      kind: 'steam',
      x: [-0.1, 0.08, -0.02][i]! + 0.06 * p * (i % 2 ? 1 : -1),
      y: head * 0.92 + 0.32 * p,
      size: 0.13 + 0.12 * p,
      rot: 0,
      opacity: p > 0.6 ? 1 - (p - 0.6) * 2.2 : 0.95,
    });
  }
  return f;
}

// ---------------------------------------------------------------- the loss sequences

export interface LossInput {
  /** the stage before the last miss: 7 on Easy and Normal, 6 on Hard */
  from: number;
  heatFrom: number;
}

/** When each loss has played out and the puddle is at rest; the heading comes in then. Tapping skips here. */
export const LOSS_MS: Record<LossOption, number> = { sploosh: 2000, hat: 2300, sink: 2900 };

export function lossFrame(option: LossOption, m: LossInput, t: number): Frame {
  const end = LOSS_MS[option];
  const f = option === 'sploosh' ? splooshLoss(m, Math.min(t, end)) : option === 'hat' ? hatLoss(m, Math.min(t, end)) : sinkLoss(m, Math.min(t, end));
  if (t >= end) {
    rest(f, t - end);
    f.heading = t >= end + 150;
  }
  return f;
}

/** The puddle at rest, after any loss: the hat floats and bobs, the carrot bobs, the eyes blink up at you. */
function rest(f: Frame, t: number) {
  f.body = 'puddle';
  f.sx = f.sy = 1;
  f.dx = f.sink = 0;
  f.particles = [];
  f.beam = null;
  f.flare = null;
  f.sun = { mood: 'gleeful', scale: 1, dx: 0, dy: 0 };
  f.heat = 1;
  const hatUp = Math.floor(t / 650) % 2 === 1;
  f.hat = { piece: 'puddle-hat', x: 0, y: hatUp ? 0.012 : 0, rot: hatUp ? -2.5 : 1.5, sy: 1 };
  const carrotUp = Math.floor((t + 325) / 650) % 2 === 1;
  f.carrot = { y: carrotUp ? 0.01 : 0, rot: carrotUp ? 4 : -2, scale: 1 };
  // blink every 2.4 s; every other time a double blink
  const c = t % 4800;
  f.eyesClosed = (c >= 700 && c < 830) || (c >= 3100 && c < 3230) || (c >= 3330 && c < 3460);
}

/** Splash drops thrown out of the puddle when something lands. */
function splash(f: Frame, t: number, at: number, n: number, spread: number, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = -1 + (2 * i) / Math.max(1, n - 1);
    const p = thrown('splash', t, at, 560, {
      x0: a * 0.16 * spread,
      y0: 0.05,
      vx: a * 0.55 * spread,
      vy: (0.9 + 0.45 * (1 - Math.abs(a))) * power,
      size: 0.075 + 0.025 * (i % 2),
      spin: a * 160,
      floor: 0,
    });
    if (p) f.particles.push(p);
  }
}

/** A. He trembles, drops through what is left of him and goes SPLAT. The hat and carrot pop up and land. */
function splooshLoss(m: LossInput, t: number): Frame {
  const f = base(m.from, m.heatFrom + (1 - m.heatFrom) * steps(t, 100, 400, 4));
  flareSun(f, t, 0, 1.5);
  f.sun.mood = 'gleeful';
  f.dx = shiver(t, 0, 440, 0.014, 55);
  // drop through the stages left, then splat
  const path = [];
  for (let s = m.from + 1; s <= 7; s++) path.push(s);
  let at = 440;
  for (const s of path) {
    if (t >= at) f.body = s;
    at += 130;
  }
  const SPLAT = at;
  if (t < SPLAT) return f;
  f.body = 'puddle';
  const sq = held(t, [
    [SPLAT, [1.28, 0.62]],
    [SPLAT + 100, [0.9, 1.12]],
    [SPLAT + 200, [1.06, 0.95]],
    [SPLAT + 300, [1, 1]],
  ] as const);
  f.sx = sq[0];
  f.sy = sq[1];
  splash(f, t, SPLAT, 8, 1.3, 1.35);
  // the hat and the carrot pop up and come down
  // (every key here lands on the splat's own 100 ms beat, so no pose is held for less than that)
  const hatK = held(t, [
    [SPLAT, [0.3, -14, 1]],
    [SPLAT + 100, [0.46, -24, 1]],
    [SPLAT + 200, [0.44, -10, 1]],
    [SPLAT + 300, [0.28, 6, 1]],
    [SPLAT + 400, [0.08, 4, 1]],
    [SPLAT + 500, [0, 0, 0.86]],
    [SPLAT + 600, [0.015, 0, 1.04]],
    [SPLAT + 700, [0, 0, 1]],
  ] as const);
  f.hat = { piece: 'puddle-hat', x: -0.04 * (hatK[0] > 0 ? 1 : 0), y: hatK[0], rot: hatK[1], sy: hatK[2] };
  const carrotK = held(t, [
    [SPLAT, [0.16, 30]],
    [SPLAT + 100, [0.22, 60]],
    [SPLAT + 200, [0.14, 20]],
    [SPLAT + 300, [0, -6]],
    [SPLAT + 400, [0, 0]],
  ] as const);
  f.carrot = { y: carrotK[0], rot: carrotK[1], scale: 1 };
  f.eyesClosed = t < SPLAT + 760 || (t >= SPLAT + 1000 && t < SPLAT + 1120);
  if (t >= SPLAT + 500) splash(f, t, SPLAT + 500, 4, 0.5, 0.6);
  return f;
}

/** B. He melts out from under his hat. It hangs in the air, looks down, then drops into the puddle. */
function hatLoss(m: LossInput, t: number): Frame {
  const f = base(m.from, m.heatFrom + (1 - m.heatFrom) * steps(t, 100, 400, 4));
  flareSun(f, t, 0, 1.5);
  f.sun.mood = 'gleeful';
  f.dx = shiver(t, 0, 380, 0.012, 55);
  const DROP = 380;
  if (t < DROP) return f;
  // gone in a blink: the puddle is all that is left under the hat
  f.body = 'puddle';
  const sq = held(t, [
    [DROP, [1.22, 0.7]],
    [DROP + 100, [0.94, 1.08]],
    [DROP + 200, [1, 1]],
  ] as const);
  f.sx = sq[0];
  f.sy = sq[1];
  splash(f, t, DROP, 6, 1, 0.8);
  f.carrot = { y: 0, rot: 0, scale: 1 };
  const hatPiece = m.from >= 7 ? 'hat-7' : 'hat-6';
  // it hangs there, looks down, a beat... and falls
  const FALL = 1500;
  const look = held(t, [
    [DROP, 0],
    [800, -9],
    [1000, 9],
    [1200, -4],
    [1320, 0],
  ] as const);
  // it jumps up off him in surprise and hangs there, well clear of the puddle
  const HANG = 0.3;
  const up = held(t, [
    [DROP, 0.12],
    [DROP + 100, 0.26],
    [DROP + 200, HANG + 0.03],
    [DROP + 300, HANG],
  ] as const);
  if (t < FALL) {
    f.hat = { piece: hatPiece, x: 0, y: up, rot: look, sy: 1 };
    // the eyes look up at it and blink once
    f.eyesClosed = (t >= DROP && t < DROP + 300) || (t >= 1100 && t < 1220);
    return f;
  }
  const fall = held(t, [
    [FALL, 0.12],
    [FALL + 80, 0.35],
    [FALL + 160, 0.68],
    [FALL + 230, 1],
  ] as const);
  const LAND = FALL + 230;
  if (t < LAND) {
    // part way from where it hung to where it will lie in the puddle
    f.hat = { piece: hatPiece, x: 0, y: HANG * (1 - fall), rot: fall * 14, sy: 1, fall };
    return f;
  }
  f.hat = {
    piece: 'puddle-hat',
    x: 0,
    y: 0,
    rot: 0,
    sy: held(t, [
      [LAND, 0.82],
      [LAND + 120, 1.06],
      [LAND + 240, 1],
    ] as const),
  };
  splash(f, t, LAND, 5, 0.7, 0.7);
  const bob = held(t, [
    [LAND, -0.012],
    [LAND + 120, 0.01],
    [LAND + 240, 0],
  ] as const);
  f.carrot = { y: bob, rot: bob * 300, scale: 1 };
  f.eyesClosed = t >= LAND && t < LAND + 160;
  return f;
}

/** C. He sinks into the puddle with bubbles; then the hat, the carrot and his eyes bloop back up. */
function sinkLoss(m: LossInput, t: number): Frame {
  const f = base(m.from, m.heatFrom + (1 - m.heatFrom) * steps(t, 100, 400, 4));
  flareSun(f, t, 0, 1.5);
  f.sun.mood = 'gleeful';
  f.dx = shiver(t, 0, 385, 0.01, 55);
  const SINK = 385;
  const SUNK = 1350;
  // the puddle spreads under him while he sinks into it
  const h = stageHeight(m.from);
  if (t >= SINK) {
    f.sink = h * steps(t, SINK, SUNK, 9);
    f.sy = 1;
  }
  f.puddleScale = t < SINK ? 0 : 0.45 + 0.55 * steps(t, SINK, SUNK, 6);
  // bubbles while he goes down and just after
  for (let i = 0; i < 6; i++) {
    const start = SINK + 120 + i * 190;
    if (t < start || t > start + 420) continue;
    const p = steps(t, start, start + 420, 4);
    f.particles.push({ kind: 'bubble', x: [-0.12, 0.1, -0.02, 0.16, -0.18, 0.04][i]!, y: 0.06 + 0.2 * p, size: 0.06 + 0.025 * (i % 3), rot: 0, opacity: p > 0.75 ? 0.4 : 1 });
  }
  if (t < SUNK) return f;
  f.body = 'puddle';
  f.sink = 0;
  f.puddleScale = 1;
  f.eyesClosed = true;
  f.hat = null;
  f.carrot = null;
  // bloop: the hat comes up first
  const HAT = SUNK + 350;
  if (t >= HAT) {
    const k = held(t, [
      [HAT, [-0.06, 0.6]],
      [HAT + 90, [0.04, 1.08]],
      [HAT + 180, [-0.008, 0.96]],
      [HAT + 270, [0, 1]],
    ] as const);
    f.hat = { piece: 'puddle-hat', x: 0, y: k[0], rot: 0, sy: k[1] };
    splash(f, t, HAT + 60, 4, 0.6, 0.55);
  }
  // then the carrot
  const CARROT = HAT + 450;
  if (t >= CARROT) {
    const k = held(t, [
      [CARROT, [0.4, -0.02]],
      [CARROT + 90, [1.15, 0.03]],
      [CARROT + 180, [1, 0]],
    ] as const);
    f.carrot = { y: k[1], rot: 0, scale: k[0] };
  }
  // and last, the eyes open: blink, blink
  const EYES = CARROT + 420;
  f.eyesClosed = t < EYES || (t >= EYES + 160 && t < EYES + 260);
  return f;
}
