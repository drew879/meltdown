import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, MISS_LIMITS, meltStage } from './difficulty';
import { applyGuess, createRound, missLimit, roundCells, roundMeltStage, roundMisses, roundOutcome, type Round } from './round';
import { puzzleFromSetter } from './source';
import type { Difficulty } from './difficulty';

function round(answer: string, difficulty: Difficulty = 'normal'): Round {
  const p = puzzleFromSetter({ answer, category: { id: 'animal' } }, 0);
  if (!p.ok) throw new Error('bad test puzzle');
  return createRound(1, difficulty, p.value);
}
function guess(r: Round, letters: string): Round {
  let cur = r;
  for (const l of letters) {
    const a = applyGuess(cur, l);
    if (!a.ok) throw new Error(a.error.code);
    cur = a.value.round;
  }
  return cur;
}

describe('miss limits', () => {
  it('are 8, 6 and 4', () => {
    expect(MISS_LIMITS).toEqual({ easy: 8, normal: 6, hard: 4 });
  });
  it.each(DIFFICULTIES)('%s loses exactly at its limit', (d) => {
    const limit = MISS_LIMITS[d];
    const wrong = 'QXZJKVWYB'.slice(0, limit);
    const almost = guess(round('cat', d), wrong.slice(0, limit - 1));
    expect(roundOutcome(almost)).toBe('playing');
    const lost = guess(almost, wrong[limit - 1]);
    expect(roundOutcome(lost)).toBe('lost');
    expect(missLimit(lost)).toBe(limit);
  });
});

describe('guessing', () => {
  it('is case-insensitive', () => {
    const r = guess(round('Cat'), 'c');
    expect(r.guessed).toEqual(['C']);
    expect(roundMisses(r)).toBe(0);
  });
  it('ignores repeats without costing a miss', () => {
    const first = applyGuess(round('cat'), 'z');
    expect(first.ok && first.value.status).toBe('wrong');
    const r1 = first.ok ? first.value.round : round('cat');
    const again = applyGuess(r1, 'Z');
    expect(again.ok && again.value.status).toBe('repeat');
    expect(again.ok && again.value.round).toBe(r1);
    expect(roundMisses(r1)).toBe(1);
  });
  it('reports correct guesses and reveals every copy', () => {
    const a = applyGuess(round('banana'), 'a');
    expect(a.ok && a.value.status).toBe('correct');
    const cells = roundCells(a.ok ? a.value.round : round('banana'));
    expect(cells.map((c) => (c.revealed ? c.char : '_')).join('')).toBe('_a_a_a');
  });
  it('wins when every letter is found, punctuation shown from the start', () => {
    const r = round("it's 5");
    expect(roundCells(r).filter((c) => c.revealed).map((c) => c.char).join('')).toBe("' 5");
    const won = guess(r, 'ITS');
    expect(roundOutcome(won)).toBe('won');
  });
  it('a win on the last allowed guess is a win, not a loss', () => {
    const r = guess(round('ab', 'hard'), 'XYZ');
    expect(roundOutcome(r)).toBe('playing');
    expect(roundOutcome(guess(r, 'AB'))).toBe('won');
  });
  it('refuses guesses after the round ends and bad keys', () => {
    const done = guess(round('a'), 'a');
    const r = applyGuess(done, 'b');
    expect(!r.ok && r.error.code).toBe('round-finished');
    const bad = applyGuess(round('cat'), '7');
    expect(!bad.ok && bad.error.code).toBe('guess-invalid');
  });
  it('shows the whole answer on a loss, marking missed letters', () => {
    const lost = guess(round('cab', 'hard'), 'CXYZW');
    const cells = roundCells(lost, true);
    expect(cells.every((c) => c.revealed)).toBe(true);
    expect(cells.map((c) => c.missed)).toEqual([false, true, true]);
  });
});

describe('melt stage', () => {
  it('is Math.round(misses * 8 / limit)', () => {
    for (const limit of [4, 6, 8]) {
      for (let m = 0; m <= limit; m++) expect(meltStage(m, limit)).toBe(Math.round((m * 8) / limit));
    }
  });
  it('runs 0 to 8 and every miss lands on a new picture', () => {
    for (const d of DIFFICULTIES) {
      const limit = MISS_LIMITS[d];
      const stages = Array.from({ length: limit + 1 }, (_, m) => meltStage(m, limit));
      expect(stages[0]).toBe(0);
      expect(stages[limit]).toBe(8);
      expect(new Set(stages).size).toBe(limit + 1);
    }
  });
  it('follows the round', () => {
    const r = guess(round('cat', 'hard'), 'XY');
    expect(roundMeltStage(r)).toBe(4);
  });
});
