import { describe, expect, it } from 'vitest';
import { createInitialState, reduce, type Action, type GameState } from '../engine';
import { LOSS_HEADINGS, lossHeading, matchOverLines, roundSeed } from './copy';

function play(actions: Action[]): GameState {
  let state = createInitialState();
  for (const action of actions) {
    const next = reduce(state, action);
    if (next.error) throw new Error(`${action.type}: ${next.error.message}`);
    state = next.state;
  }
  return state;
}

const setUp: Action[] = [{ type: 'start', names: ['Dad', 'Sam'], matchLength: 'one' }];
const round = (answer: string, letters: string): Action[] => [
  { type: 'submitPuzzle', puzzle: { answer, category: { id: 'place' } }, difficulty: 'hard' },
  { type: 'confirmHandoff' },
  ...[...letters].map((letter): Action => ({ type: 'guess', letter })),
  { type: 'continue' },
];

describe('loss headings', () => {
  it('is always one of the seven, and the same one for the same round', () => {
    for (let i = 0; i < 50; i++) expect(LOSS_HEADINGS).toContain(lossHeading(roundSeed('Moon', i)));
    expect(lossHeading(roundSeed('Moon', 3))).toBe(lossHeading(roundSeed('Moon', 3)));
  });
  it('is not stuck on one heading', () => {
    const seen = new Set<string>();
    for (const word of ['Moon', 'Cat', 'Ice', 'Snow', 'Polar Bear', 'Sun', 'Hat', 'Fence', 'Grass', 'Tree']) {
      seen.add(lossHeading(roundSeed(word, 0)));
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe('match over lines', () => {
  it('names the winner and the score', () => {
    // Dad sets, Sam solves; Sam sets, Dad stumbles
    const state = play([...setUp, ...round('Moon', 'MON'), ...round('Ice', 'XQZW')]);
    expect(state.phase).toBe('matchOver');
    expect(matchOverLines(state)).toEqual({ heading: 'Sam wins!', note: 'Dad 0, Sam 1.' });
  });
  it('calls a level match a draw', () => {
    const state = play([...setUp, ...round('Moon', 'MON'), ...round('Ice', 'ICE')]);
    expect(matchOverLines(state)).toEqual({ heading: "It's a draw!", note: 'Dad 1, Sam 1.' });
  });
});
