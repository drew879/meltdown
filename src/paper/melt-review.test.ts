// Checks of the melt timeline written for the review of 2026-11-21, without
// reading melt-timeline.test.ts first, so they come at it from another side:
// every real difficulty's run of stages, the order things happen in, and that
// nothing is drawn where it cannot be.
import { describe, expect, it } from 'vitest';
import { meltStage, MISS_LIMITS } from '../engine';
import { HAT_ON, LOSS_MS, REST, hatOf, lossFrame, missFrame, missMs, restFrame, settledAt } from './melt-timeline';

/** Every millisecond of a beat, so a stage held for a moment cannot slip between samples. */
const every = (ms: number) => Array.from({ length: Math.ceil(ms) + 1 }, (_, t) => t);

for (const [difficulty, limit] of Object.entries(MISS_LIMITS)) {
  describe(`${difficulty} (${limit} misses allowed)`, () => {
    const stages = Array.from({ length: limit + 1 }, (_, m) => meltStage(m, limit));

    it('loses from the stage the hats were measured on', () => {
      const before = stages[limit - 1]!;
      expect(Object.keys(HAT_ON)).toContain(hatOf(before));
      expect(before).toBe(difficulty === 'hard' ? 6 : 7);
    });

    for (let m = 1; m < limit; m++) {
      const from = stages[m - 1]!;
      const to = stages[m]!;
      it(`miss ${m} (stage ${from} to ${to}) goes down through every stage in between, in order, and ends on ${to}`, () => {
        const seen: number[] = [];
        for (const t of every(missMs(from, to))) {
          const body = missFrame(from, to, t).body;
          expect(typeof body).toBe('number');
          if (seen.at(-1) !== body) seen.push(body as number);
        }
        expect(seen).toEqual(Array.from({ length: to - from + 1 }, (_, i) => from + i));
        expect(missFrame(from, to, missMs(from, to)).body).toBe(to);
        expect(settledAt(from, to)).toBeLessThan(missMs(from, to));
      });

      it(`miss ${m} ends standing still, at full size, with the sun back to normal`, () => {
        const end = missFrame(from, to, missMs(from, to) - 1);
        expect([end.sx, end.sy, end.dx, end.sunScale]).toEqual([1, 1, 0, 1]);
        expect(end.flare).toBeNull();
      });
    }
  });
}

describe('the miss beat', () => {
  it('never draws a drop or wiggle under the grass, or one that is not there at all', () => {
    for (const [from, to] of [[0, 1], [0, 2], [5, 7], [4, 6]] as const) {
      for (const t of every(missMs(from, to))) {
        for (const p of missFrame(from, to, t).particles) {
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.opacity).toBeGreaterThan(0);
          expect(p.opacity).toBeLessThanOrEqual(1);
          expect(p.size).toBeGreaterThan(0);
        }
      }
    }
  });

  it('is a pure function of time', () => {
    expect(missFrame(1, 3, 517)).toEqual(missFrame(1, 3, 517));
  });
});

describe('the loss', () => {
  for (const from of [6, 7]) {
    it(`from stage ${from}: the stage first, then the puddle, never anything else`, () => {
      let puddle = false;
      for (const t of every(LOSS_MS + 1000)) {
        const f = lossFrame(from, t);
        if (f.body === 'puddle') puddle = true;
        else {
          expect(puddle).toBe(false); // once he is a puddle he never stands up again
          expect(f.body).toBe(from);
        }
      }
      expect(puddle).toBe(true);
    });

    it(`from stage ${from}: once he is gone the hat is always drawn, first his own and at the end the one in the puddle`, () => {
      const hats: string[] = [];
      for (const t of every(LOSS_MS + 1000)) {
        const f = lossFrame(from, t);
        if (f.body !== 'puddle') {
          expect(f.hat).toBeNull(); // the stage has its own hat drawn on
          continue;
        }
        expect(f.hat).not.toBeNull();
        if (hats.at(-1) !== f.hat!.piece) hats.push(f.hat!.piece);
      }
      expect(hats).toEqual([hatOf(from), 'puddle-hat']);
    });

    it(`from stage ${from}: the hat hangs above the puddle before it drops, and lands where it lies at rest`, () => {
      const before = every(LOSS_MS).map((t) => lossFrame(from, t)).filter((f) => f.hat && f.hat.piece !== 'puddle-hat');
      expect(Math.max(...before.map((f) => f.hat!.y))).toBeGreaterThan(REST.hat.y);
      const landed = lossFrame(from, LOSS_MS - 1).hat!;
      expect([landed.x, landed.y, landed.sy]).toEqual([REST.hat.x, REST.hat.y, 1]);
    });

    it(`from stage ${from}: at its end it is exactly the puddle at rest, and the rest carries on from there`, () => {
      expect(lossFrame(from, LOSS_MS)).toEqual(restFrame(0));
      expect(lossFrame(from, LOSS_MS + 4321)).toEqual(restFrame(4321));
    });
  }

  it('the puddle at rest keeps everything in it: hat, carrot and eyes', () => {
    for (const t of [null, ...every(6000).filter((t) => t % 10 === 0)]) {
      const f = restFrame(t);
      expect(f.body).toBe('puddle');
      expect(f.hat?.piece).toBe('puddle-hat');
      expect(f.carrot).not.toBeNull();
      expect(f.eyes === 'open' || f.eyes === 'closed').toBe(true);
      expect(f.particles).toEqual([]);
    }
    expect(restFrame(null).eyes).toBe('open'); // the still picture has its eyes open
  });
});
