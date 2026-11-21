import { describe, expect, it } from 'vitest';
import manifest from './art-manifest.json';
import {
  BACKFLIP,
  CELEBRATION_PIECES,
  CLOUD_FROM,
  CLOUD_TO,
  FLAKES,
  SNOW_FROM,
  SNOW_UNTIL,
  TOTAL_MS,
  cloudProgress,
  flakeFall,
  keyAt,
  clampedLift,
  stepped,
} from './celebration-timeline';

describe('stepped', () => {
  it('copes with a single step, and holds at 1 from the last step on', () => {
    expect(stepped(0.5, 1)).toBe(0);
    expect(stepped(1, 1)).toBe(1);
    expect(stepped(7 / 8, 8)).toBe(1);
    expect(stepped(0.99, 8)).toBe(1);
  });
  it('holds, then jumps, and reaches exactly 1', () => {
    expect(stepped(0, 8)).toBe(0);
    expect(stepped(0.1, 8)).toBe(0);
    expect(stepped(0.13, 8)).toBeCloseTo(1 / 7);
    expect(stepped(1, 8)).toBe(1);
  });
  it('stays inside 0 to 1 whatever it is given', () => {
    expect(stepped(-3, 8)).toBe(0);
    expect(stepped(9, 8)).toBe(1);
  });
  it('never goes backwards', () => {
    let last = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const v = stepped(p, 14);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe('the backflip', () => {
  it('starts with the fresh snowman and its keys are in time order', () => {
    expect(BACKFLIP[0]).toMatchObject({ at: 0, piece: 'snowman-0' });
    for (let i = 1; i < BACKFLIP.length; i++) expect(BACKFLIP[i]!.at).toBeGreaterThan(BACKFLIP[i - 1]!.at);
  });
  it('only uses pieces that were cut', () => {
    for (const key of BACKFLIP) expect(manifest).toHaveProperty(key.piece);
    for (const piece of CELEBRATION_PIECES) expect(manifest).toHaveProperty(piece);
  });
  it('plays the poses in order: crouch, flip, land, finish', () => {
    const order = BACKFLIP.map((k) => k.piece).filter((piece, i, all) => piece !== all[i - 1]);
    expect(order.slice(0, 5)).toEqual(['snowman-0', 'win-backflip-1', 'win-backflip-2', 'win-backflip-3', 'win-backflip-4']);
    expect(keyAt(100).piece).toBe('snowman-0');
    expect(keyAt(300).piece).toBe('win-backflip-1');
    expect(keyAt(900).piece).toBe('win-backflip-2');
    expect(keyAt(1400).piece).toBe('win-backflip-3');
    expect(keyAt(2000).piece).toBe('win-backflip-4');
  });
  it('goes up and comes back down, and never lifts above half his height', () => {
    const lifts = BACKFLIP.map((k) => k.lift ?? 0);
    expect(Math.max(...lifts)).toBeLessThanOrEqual(0.5);
    const air = BACKFLIP.filter((k) => k.piece === 'win-backflip-2').map((k) => k.lift ?? 0);
    expect(air.indexOf(Math.max(...air))).toBeGreaterThan(0);
    expect(air.indexOf(Math.max(...air))).toBeLessThan(air.length - 1);
  });
  it('ends at rest in the finishing pose, on the ground', () => {
    const rest = keyAt(TOTAL_MS);
    expect(rest.piece).toBe('win-backflip-4');
    expect(rest.lift ?? 0).toBe(0);
    expect(rest.rot ?? 0).toBe(0);
    expect(rest.sx ?? 1).toBe(1);
  });
});

describe('the cloud', () => {
  it('is not there before it rolls in, and has covered the sun by the end', () => {
    expect(cloudProgress(CLOUD_FROM - 1)).toBeNull();
    expect(cloudProgress(CLOUD_FROM)).toBe(0);
    expect(cloudProgress(CLOUD_TO)).toBe(1);
    expect(cloudProgress(TOTAL_MS)).toBe(1);
  });
});

describe('the snow', () => {
  it('has a fixed set of flakes that start and land inside the celebration', () => {
    expect(FLAKES.length).toBe(30);
    for (const f of FLAKES) {
      expect(f.start).toBeGreaterThanOrEqual(SNOW_FROM);
      expect(f.start).toBeLessThanOrEqual(SNOW_UNTIL + 120);
      expect(f.start + f.duration).toBeLessThanOrEqual(TOTAL_MS);
      expect(manifest).toHaveProperty(f.piece);
    }
  });
  it('puts two flakes in three behind the snowman', () => {
    expect(FLAKES.filter((f) => f.behind).length).toBe(20);
  });
  it('falls only while it is in the air, and all of it has landed by the end', () => {
    const f = FLAKES[0]!;
    expect(flakeFall(f, f.start - 1)).toBeNull();
    expect(flakeFall(f, f.start)).toBe(0);
    expect(flakeFall(f, f.start + f.duration)).toBe(1);
    expect(flakeFall(f, f.start + f.duration + 1)).toBeNull();
    for (const flake of FLAKES) expect(flakeFall(flake, TOTAL_MS + 1)).toBeNull();
  });
  it('spreads the flakes over the snowing time, cycling through the six shapes', () => {
    const starts = FLAKES.map((f) => f.start);
    expect(Math.min(...starts)).toBeLessThan(SNOW_FROM + 300);
    expect(Math.max(...starts)).toBeGreaterThan(SNOW_UNTIL - 400);
    expect(FLAKES.map((f) => f.piece).slice(0, 7)).toEqual(['flake-1', 'flake-2', 'flake-3', 'flake-4', 'flake-5', 'flake-6', 'flake-1']);
  });
});

describe('the lift clamp', () => {
  // the tucked, upside-down pose: it turns about his middle, so its reach depends on the turn
  const flip = BACKFLIP.find((k) => k.piece === 'win-backflip-2' && k.lift === 0.5)!;
  const tilted = BACKFLIP.find((k) => k.piece === 'win-backflip-2' && k.rot === -42)!;
  const w = 220;
  const h = 225;

  /** The highest his top gets above the scene's top edge, given the lift (negative would mean through it). */
  const headroom = (key: typeof flip, lift: number, baseY: number) => {
    const rad = (Math.abs(key.rot ?? 0) * Math.PI) / 180;
    const half = (h * Math.cos(rad) + w * Math.sin(rad)) / 2;
    return baseY - lift - h / 2 - half;
  };

  it('leaves the jump alone when the scene is tall', () => {
    expect(clampedLift(flip, w, h, 350, 500)).toBe(0.5 * 350);
  });
  it('shortens the jump on a short scene so he stays inside it, with a margin', () => {
    const lift = clampedLift(flip, w, h, 230, 270);
    expect(lift).toBeGreaterThan(0);
    expect(lift).toBeLessThan(0.5 * 230);
    expect(headroom(flip, lift, 270)).toBeCloseTo(4, 5);
  });
  it('allows for the turn: tilted, his box reaches higher, so the clamp holds him lower', () => {
    const full = 230;
    const baseY = 300;
    const turned = clampedLift(tilted, w, h, full, baseY);
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(tilted.lift! * full);
    expect(headroom(tilted, turned, baseY)).toBeCloseTo(4, 5);
    // upright, the same scene lets him go higher before the clamp bites
    expect(clampedLift(flip, w, h, full, baseY)).toBeGreaterThan(turned);
  });
  it('is never negative, even on a scene too short for him to leave the ground', () => {
    expect(clampedLift(flip, w, h, 230, 100)).toBe(0);
  });
  it('is nothing for a pose that stays on the ground', () => {
    expect(clampedLift({ at: 0, piece: 'win-backflip-1' }, w, h, 350, 500)).toBe(0);
  });
  it('counts a stretch: the finishing hop is held down when he is stretched taller', () => {
    const hop = BACKFLIP.find((k) => k.piece === 'win-backflip-4' && k.sy)!;
    const plain = { at: hop.at, piece: hop.piece, lift: hop.lift };
    const tightBase = 235;
    expect(clampedLift(hop, w, 400, 400, tightBase)).toBeLessThanOrEqual(clampedLift(plain, w, 400, 400, tightBase));
  });
});
