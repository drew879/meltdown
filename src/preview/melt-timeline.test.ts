import { describe, expect, it } from 'vitest';
import {
  LOSS_MS,
  LOSS_OPTIONS,
  MISS_MS,
  MISS_OPTIONS,
  lossFrame,
  missFrame,
  stageFor,
  type Frame,
} from './melt-timeline';

const LIMITS = [8, 6, 4];

describe('which stage each miss lands on', () => {
  it('matches the brief at every difficulty, a new stage every miss, the puddle last', () => {
    expect(LIMITS.map((n) => Array.from({ length: n + 1 }, (_, m) => stageFor(m, n)))).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      [0, 1, 3, 4, 5, 7, 8],
      [0, 2, 4, 6, 8],
    ]);
  });
});

describe('the miss beats', () => {
  for (const { id } of MISS_OPTIONS)
    for (const n of LIMITS)
      it(`${id}, ${n} misses allowed: starts on the old stage and ends on the new one`, () => {
        for (let m = 1; m < n; m++) {
          const input = { from: stageFor(m - 1, n), to: stageFor(m, n), heatFrom: (m - 1) / n, heatTo: m / n };
          expect(missFrame(id, input, 0).body).toBe(input.from);
          const end = missFrame(id, input, MISS_MS[id]);
          expect(end.body).toBe(input.to);
          expect([end.sx, end.sy, end.dx, end.sink]).toEqual([1, 1, 0, 0]);
          expect(end.heat).toBeCloseTo(input.heatTo);
          expect(end.particles).toEqual([]);
        }
      });
});

describe('the loss sequences', () => {
  for (const { id } of LOSS_OPTIONS)
    for (const from of [6, 7])
      it(`${id} from stage ${from}: ends in the puddle, hat and carrot on it, eyes open, heading up`, () => {
        const start = lossFrame(id, { from, heatFrom: 0.8 }, 0);
        expect(start.body).toBe(from);
        const rest = lossFrame(id, { from, heatFrom: 0.8 }, LOSS_MS[id] + 200);
        expect(rest.body).toBe('puddle');
        expect(rest.hat?.piece).toBe('puddle-hat');
        expect(rest.carrot).not.toBeNull();
        expect(rest.eyesClosed).toBe(false);
        expect(rest.heading).toBe(true);
        expect(rest.heat).toBe(1);
        expect(lossFrame(id, { from, heatFrom: 0.8 }, LOSS_MS[id] - 1).heading).toBe(false);
      });

  it('each plays in about two to three seconds', () => {
    for (const ms of Object.values(LOSS_MS)) expect(ms).toBeGreaterThanOrEqual(2000), expect(ms).toBeLessThanOrEqual(3000);
  });

  it('at rest the eyes blink and the hat bobs, now and then', () => {
    const at = (t: number) => lossFrame('sploosh', { from: 7, heatFrom: 0.8 }, LOSS_MS.sploosh + t);
    const samples = Array.from({ length: 480 }, (_, i) => at(i * 10));
    expect(samples.some((f) => f.eyesClosed)).toBe(true);
    expect(samples.filter((f) => f.eyesClosed).length).toBeLessThan(samples.length * 0.15);
    expect(new Set(samples.map((f) => f.hat!.y)).size).toBe(2);
  });
});

describe('stop-motion', () => {
  // the snowman's pose is held for at least 40 ms at a time: it jumps, it never glides
  const pose = (f: Frame) => JSON.stringify([f.body, f.sx, f.sy, f.dx, f.sink, f.hat, f.carrot]);
  function shortestHold(frameAt: (t: number) => Frame, until: number) {
    let last = pose(frameAt(0));
    let since = 0;
    let shortest = Infinity;
    for (let t = 1; t <= until; t++) {
      const now = pose(frameAt(t));
      if (now !== last) {
        shortest = Math.min(shortest, t - since);
        since = t;
        last = now;
      }
    }
    return shortest;
  }
  for (const { id } of MISS_OPTIONS)
    it(`miss ${id}`, () => {
      expect(shortestHold((t) => missFrame(id, { from: 0, to: 2, heatFrom: 0, heatTo: 0.25 }, t), MISS_MS[id])).toBeGreaterThanOrEqual(40);
    });
  for (const { id } of LOSS_OPTIONS)
    it(`loss ${id}`, () => {
      expect(shortestHold((t) => lossFrame(id, { from: 6, heatFrom: 0.75 }, t), LOSS_MS[id])).toBeGreaterThanOrEqual(40);
    });
});
