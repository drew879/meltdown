import { describe, expect, it } from 'vitest';
import { MISS_LIMITS, meltStage } from '../engine';
import {
  FULL,
  HAT_ON,
  LOSS_MS,
  REST,
  hatOf,
  lossFrame,
  missFrame,
  missMs,
  restFrame,
  settledAt,
  slumpPath,
  stageHeight,
  steps,
  type MeltFrame,
} from './melt-timeline';

const LIMITS = Object.values(MISS_LIMITS);
/** Every miss that is not the last one, at every difficulty: [stage before, stage after]. */
const MISSES = LIMITS.flatMap((limit) =>
  Array.from({ length: limit - 1 }, (_, i) => [meltStage(i, limit), meltStage(i + 1, limit)] as const),
);
/** The stage each difficulty is lost from. */
const LAST = LIMITS.map((limit) => meltStage(limit - 1, limit));

describe('steps', () => {
  it('holds, jumps, and reaches exactly 1 on its last step', () => {
    expect(steps(0, 100, 500, 4)).toBe(0);
    expect(steps(199, 100, 500, 4)).toBe(0);
    expect(steps(200, 100, 500, 4)).toBeCloseTo(1 / 3);
    expect(steps(400, 100, 500, 4)).toBe(1);
    expect(steps(900, 100, 500, 4)).toBe(1);
  });
  it('with a single step holds 0 and jumps to 1 at the end, never dividing by nothing', () => {
    expect([100, 101, 300, 499, 500, 501].map((t) => steps(t, 100, 500, 1))).toEqual([0, 0, 0, 0, 1, 1]);
    expect([100, 300, 500].map((t) => steps(t, 100, 500, 0))).toEqual([0, 0, 1]);
    for (let t = 0; t <= 600; t += 7) for (const n of [0, 1, 2, 3, 6]) expect(Number.isFinite(steps(t, 100, 500, n))).toBe(true);
  });
});

describe('a wrong guess', () => {
  it('starts on the old stage, standing still, with the sun already flaring', () => {
    for (const [from, to] of MISSES) {
      const f = missFrame(from, to, 0);
      expect(f.body).toBe(from);
      expect([f.sx, f.sy, f.dx]).toEqual([1, 1, 0]);
      expect(f.sunScale).toBeGreaterThan(1);
      expect(f.flare).not.toBeNull();
    }
  });

  it('ends on the new stage, standing still, with nothing left in the air and the sun back to size', () => {
    for (const [from, to] of MISSES) {
      const f = missFrame(from, to, missMs(from, to));
      expect(f).toEqual({ body: to, sx: 1, sy: 1, dx: 0, sunScale: 1, flare: null, hat: null, carrot: null, eyes: null, particles: [] });
    }
  });

  it('slumps through every stage in between, in order, each held long enough to see', () => {
    for (const [from, to] of MISSES) {
      const seen: number[] = [];
      const heldFor = new Map<number, number>();
      for (let t = 0; t <= missMs(from, to); t++) {
        const body = missFrame(from, to, t).body as number;
        if (seen[seen.length - 1] !== body) seen.push(body);
        heldFor.set(body, (heldFor.get(body) ?? 0) + 1);
      }
      expect(seen).toEqual([from, ...slumpPath(from, to)]);
      for (const stage of slumpPath(from, to)) expect(heldFor.get(stage)).toBeGreaterThanOrEqual(100);
    }
  });

  it('never skips more than one stage on Easy, and shows the skipped ones on Normal and Hard', () => {
    expect(slumpPath(3, 4)).toEqual([4]);
    expect(slumpPath(1, 3)).toEqual([2, 3]);
    expect(slumpPath(4, 6)).toEqual([5, 6]);
  });

  it('is over in about a second and a bit, whatever the difficulty', () => {
    for (const [from, to] of MISSES) {
      expect(missMs(from, to)).toBeGreaterThanOrEqual(1000);
      expect(missMs(from, to)).toBeLessThanOrEqual(1400);
      expect(settledAt(from, to)).toBeLessThan(missMs(from, to));
    }
  });

  it('sends heat up behind him and two drops of sweat off his head as he settles', () => {
    for (const [from, to] of MISSES) {
      const during = missFrame(from, to, 500).particles;
      expect(during.filter((p) => p.piece !== 'drop').every((p) => p.behind)).toBe(true);
      expect(during.some((p) => p.piece === 'heat-1')).toBe(true);
      const after = missFrame(from, to, settledAt(from, to) + 100).particles.filter((p) => p.piece === 'drop');
      expect(after.map((p) => Math.sign(p.x))).toEqual([-1, 1]);
      for (const drop of after) expect(drop.y).toBeGreaterThan(stageHeight(to) * 0.8);
    }
  });

  it('keeps the heat off his face: beside him, or rising from behind the top of his hat', () => {
    for (const [from, to] of MISSES)
      for (let t = 0; t <= missMs(from, to); t += 20) {
        const f = missFrame(from, to, t);
        const top = stageHeight(f.body as number);
        for (const p of f.particles.filter((q) => q.piece !== 'drop'))
          expect(Math.abs(p.x) > 0.25 * FULL || p.y >= top, `${from} to ${to} at ${t}`).toBe(true);
      }
  });
});

describe('the last wrong guess', () => {
  it('starts on the stage he was at, with the sun flaring bigger than for a plain miss', () => {
    for (const from of LAST) {
      expect(lossFrame(from, 0).body).toBe(from);
      expect(lossFrame(from, 150).sunScale).toBeGreaterThan(missFrame(0, 1, 150).sunScale);
    }
  });

  it('is only ever lost from stage 6 or 7, the two stages with a loose hat', () => {
    expect([...new Set(LAST)].sort()).toEqual([6, 7]);
    expect(LAST.map(hatOf).sort()).toEqual(['hat-6', 'hat-7', 'hat-7']);
  });

  it('leaves the hat where it sat on his head, then hanging well clear of the puddle', () => {
    for (const from of LAST) {
      const on = HAT_ON[hatOf(from)];
      const first = lossFrame(from, 360);
      expect(first.body).toBe('puddle');
      expect(first.hat!.piece).toBe(hatOf(from));
      expect(first.hat!.y).toBeGreaterThan(on.y); // it jumps in the same frame, so a new drawing of the hat never has to match pixel for pixel
      expect(Math.hypot(first.hat!.x - on.x, first.hat!.y - on.y)).toBeLessThan(0.15 * FULL); // but it starts near where it sat
      const hanging = lossFrame(from, 1300).hat!;
      expect(hanging.piece).toBe(hatOf(from));
      expect(hanging.y - REST.hat.y).toBeGreaterThan(0.25 * FULL);
      expect(hanging.x).toBe(REST.hat.x); // above where it will land, so it drops straight down
    }
  });

  it('drops the hat straight down into its place, never below it', () => {
    for (const from of LAST) {
      let last = Infinity;
      for (let t = 1500; t < LOSS_MS; t += 10) {
        const hat = lossFrame(from, t).hat!;
        expect(hat.y).toBeLessThanOrEqual(last);
        expect(hat.y).toBeGreaterThanOrEqual(REST.hat.y);
        expect(hat.x).toBe(REST.hat.x);
        last = hat.y;
      }
      expect(lossFrame(from, LOSS_MS - 1).hat).toEqual({ piece: 'puddle-hat', x: REST.hat.x, y: REST.hat.y, rot: 0, sy: 1 });
    }
  });

  it('plays in two to three seconds and ends in the puddle at rest', () => {
    expect(LOSS_MS).toBeGreaterThanOrEqual(2000);
    expect(LOSS_MS).toBeLessThanOrEqual(3000);
    for (const from of LAST) {
      const end = lossFrame(from, LOSS_MS);
      expect(end).toEqual(restFrame(0));
      expect(end.body).toBe('puddle');
      expect(end.particles).toEqual([]);
      expect(end.sunScale).toBe(1);
      expect(end.flare).toBeNull();
    }
  });
});

describe('the puddle at rest', () => {
  it('has the hat, the carrot and open eyes where stage 8 has them', () => {
    const still = restFrame(null);
    expect(still.hat).toEqual({ piece: 'puddle-hat', x: REST.hat.x, y: REST.hat.y, rot: 0, sy: 1 });
    expect(still.carrot).toEqual({ x: REST.carrot.x, y: REST.carrot.y, rot: 0 });
    expect(still.eyes).toBe('open');
  });

  it('bobs the hat and the carrot out of step, and blinks now and then', () => {
    const samples = Array.from({ length: 480 }, (_, i) => restFrame(i * 10));
    expect(new Set(samples.map((f) => f.hat!.y)).size).toBe(2);
    expect(new Set(samples.map((f) => f.carrot!.y)).size).toBe(2);
    expect(samples.some((f) => f.hat!.y > REST.hat.y && f.carrot!.y === REST.carrot.y)).toBe(true);
    const closed = samples.filter((f) => f.eyes === 'closed').length;
    expect(closed).toBeGreaterThan(0);
    expect(closed).toBeLessThan(samples.length * 0.15);
  });
});

describe('stop-motion', () => {
  // what he, his hat, his carrot and his eyes are doing is held for at least 40 ms at a time: it jumps, it never glides
  const pose = (f: MeltFrame) => JSON.stringify([f.body, f.sx, f.sy, f.dx, f.hat, f.carrot, f.eyes, f.sunScale, f.flare]);
  function shortestHold(frameAt: (t: number) => MeltFrame, until: number) {
    let last = pose(frameAt(0));
    let since = 0;
    let shortest = Infinity;
    for (let t = 1; t <= until; t++) {
      const now = pose(frameAt(t));
      if (now === last) continue;
      shortest = Math.min(shortest, t - since);
      since = t;
      last = now;
    }
    return shortest;
  }
  it('a wrong guess', () => {
    for (const [from, to] of MISSES) expect(shortestHold((t) => missFrame(from, to, t), missMs(from, to)), `${from} to ${to}`).toBeGreaterThanOrEqual(40);
  });
  it('the last wrong guess, and the rest after it', () => {
    for (const from of LAST) expect(shortestHold((t) => lossFrame(from, t), LOSS_MS + 5000), `from ${from}`).toBeGreaterThanOrEqual(40);
  });
});
