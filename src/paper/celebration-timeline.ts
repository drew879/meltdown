// The win celebration, as data: which pose is held when, where the cloud is, and
// how the snow falls. Everything is a pure function of t, the milliseconds since
// the celebration began, so it can be tested without a browser and drawn at any
// moment. Motion is stop-motion: poses are held and then jump, and the cloud and
// snow move in steps, never glides. The look was chosen by Drew on 2026-11-21
// from a preview page: the backflip, with the cloud and snow.
import type { Piece } from './art';

/** One held pose, from `at` ms until the next one. */
export interface Key {
  at: number;
  piece: Piece;
  /** how far off the ground, as a share of the fresh snowman's height */
  lift?: number;
  rot?: number;
  sx?: number;
  sy?: number;
  /** turn about his middle rather than his feet (for the flip) */
  centre?: boolean;
}

const FRESH: Key = { at: 0, piece: 'snowman-0' };

/**
 * Crouch, jump, flip, land, finish with both arms up. The flip is the one
 * tucked, upside-down pose turned a little between held frames; the art has
 * no in-between poses (Drew called it good enough).
 */
export const BACKFLIP: readonly Key[] = (() => {
  const keys: Key[] = [
    FRESH,
    { at: 250, piece: 'win-backflip-1' },
    { at: 700, piece: 'win-backflip-2', lift: 0.26, rot: 32, centre: true },
    { at: 850, piece: 'win-backflip-2', lift: 0.5, rot: 0, centre: true },
    { at: 1000, piece: 'win-backflip-2', lift: 0.46, rot: -24, centre: true },
    { at: 1150, piece: 'win-backflip-2', lift: 0.22, rot: -42, centre: true },
    { at: 1300, piece: 'win-backflip-3' },
    { at: 1700, piece: 'win-backflip-4', lift: 0.05, sx: 0.96, sy: 1.05 },
    { at: 1850, piece: 'win-backflip-4' },
  ];
  // a little bounce of joy while the cloud and snow arrive
  for (let at = 2150; at < 4000; at += 300) keys.push({ at, piece: 'win-backflip-4', lift: (at - 2150) % 600 === 0 ? 0.015 : 0 });
  keys.push({ at: 4250, piece: 'win-backflip-4' }); // and rests
  return keys;
})();

/** Every picture the celebration draws, so they can be fetched before the first win. */
export const CELEBRATION_PIECES: readonly Piece[] = [
  'win-backflip-1',
  'win-backflip-2',
  'win-backflip-3',
  'win-backflip-4',
  'cloud',
  'flake-1',
  'flake-2',
  'flake-3',
  'flake-4',
  'flake-5',
  'flake-6',
];
const FLAKE_PIECES: readonly Piece[] = ['flake-1', 'flake-2', 'flake-3', 'flake-4', 'flake-5', 'flake-6'];

// the cloud rolls in over the sun, then snow falls
export const CLOUD_FROM = 300;
export const CLOUD_TO = 1700;
export const SNOW_FROM = 1300;
export const SNOW_UNTIL = 6100;
const CLOUD_STEPS = 8;
const FALL_STEPS = 14;
const FLAKE_COUNT = 30;

/**
 * A held step: the value stays put, then jumps. It takes `steps` steps, reaches
 * exactly 1 on the last of them (at p = (steps - 1) / steps) and holds there.
 */
export function stepped(p: number, steps: number): number {
  const clamped = Math.min(1, Math.max(0, p));
  if (steps < 2) return clamped >= 1 ? 1 : 0;
  return Math.min(1, Math.floor(clamped * steps) / (steps - 1));
}

/** How many pixels of margin to keep between the top of the scene and the highest part of him. */
const TOP_MARGIN = 4;

/**
 * How far off the ground he is at this pose, in pixels: the pose's own lift, but never so high that he
 * goes through the top of the scene (on a short screen the jump is smaller, and it can be nothing).
 * `pieceW` and `pieceH` are the picture's size on screen, `full` is the fresh snowman's height and
 * `baseY` is how far down the scene his feet stand. The reach allows for the pose's squash and turn.
 */
export function clampedLift(key: Key, pieceW: number, pieceH: number, full: number, baseY: number): number {
  const lift = (key.lift ?? 0) * full;
  if (lift <= 0) return 0;
  const w = pieceW * (key.sx ?? 1);
  const h = pieceH * (key.sy ?? 1);
  const rad = (Math.abs(key.rot ?? 0) * Math.PI) / 180;
  // how high his top is above his feet when he is not lifted: his height, or for the flip (which turns about his middle) his middle plus half the turned box
  const reach = key.centre ? h / 2 + (h * Math.cos(rad) + w * Math.sin(rad)) / 2 : h;
  return Math.max(0, Math.min(lift, baseY - TOP_MARGIN - reach));
}

/** The pose being held at t. */
export function keyAt(t: number): Key {
  let key = BACKFLIP[0]!;
  for (const candidate of BACKFLIP) if (candidate.at <= t) key = candidate;
  return key;
}

/** How far the cloud has rolled in, 0 to 1 in steps, or null before it appears. */
export function cloudProgress(t: number): number | null {
  if (t < CLOUD_FROM) return null;
  return stepped((t - CLOUD_FROM) / (CLOUD_TO - CLOUD_FROM), CLOUD_STEPS);
}

/** Small, repeatable random numbers, so the snow falls the same way every time. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Flake {
  start: number;
  duration: number;
  /** where under the cloud it starts, 0 to 1 */
  across: number;
  /** blown to the right, in screen widths */
  drift: number;
  /** in screen widths */
  size: number;
  turn: number;
  turn0: number;
  sway: number;
  phase: number;
  /** how far above the ground it fades, in snowman heights */
  land: number;
  piece: Piece;
  /** two flakes in three fall behind the snowman, so snow never buries his face */
  behind: boolean;
}

const rand = rng(11);
export const FLAKES: readonly Flake[] = Array.from({ length: FLAKE_COUNT }, (_, i) => ({
  start: SNOW_FROM + (i * (SNOW_UNTIL - SNOW_FROM)) / FLAKE_COUNT + rand() * 120,
  duration: 2400 + rand() * 1400,
  across: rand(),
  drift: 0.04 + rand() * 0.16,
  size: 0.05 + rand() * 0.05,
  turn: (rand() < 0.5 ? -1 : 1) * (90 + rand() * 150),
  turn0: rand() * 60,
  sway: 0.012 + rand() * 0.02,
  phase: rand() * 6,
  land: rand() * 0.14,
  piece: FLAKE_PIECES[i % FLAKE_PIECES.length]!,
  behind: i % 3 !== 0,
}));

/** How far a flake has fallen, 0 to 1 in steps, or null when it is not in the air. */
export function flakeFall(flake: Flake, t: number): number | null {
  const p = (t - flake.start) / flake.duration;
  if (p < 0 || p > 1) return null;
  return stepped(p, FALL_STEPS);
}

/** When everything has finished: the last pose is reached and the last flake has landed. */
export const TOTAL_MS = Math.ceil(Math.max(BACKFLIP[BACKFLIP.length - 1]!.at, ...FLAKES.map((f) => f.start + f.duration)));
