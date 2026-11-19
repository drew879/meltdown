import { describe, expect, it, vi } from 'vitest';
import { createInitialState, type GameState } from './flow';
import { guessAll, playRound, run, started, toPlay } from './helpers.test-util';
import {
  MIGRATIONS,
  SAVE_KEY,
  SAVE_VERSION,
  createSaveStore,
  parseSave,
  serializeState,
  validateState,
} from './save';
import { createMemoryStorage, getBrowserStorage, type StorageLike } from './storage';

function states(): Record<string, GameState> {
  const mid = guessAll(toPlay(started('first2'), 'polar bear', 'hard'), 'PXO');
  const result = playRound(started(), false);
  const over = run(run(playRound(started('one'), true), { type: 'continue' }), { type: 'newSession' });
  let matchOver = started('one');
  matchOver = run(playRound(matchOver, true), { type: 'continue' });
  matchOver = run(playRound(matchOver, false), { type: 'continue' });
  const handoff = run(started(), {
    type: 'submitPuzzle',
    puzzle: { answer: 'Café Noir', category: { id: 'other', custom: 'Cats' } },
    difficulty: 'easy',
  });
  return { initial: createInitialState(), setup: started(), handoff, mid, result, matchOver, over };
}

describe('save round trips', () => {
  for (const [name, state] of Object.entries(states())) {
    it(`restores ${name} exactly`, () => {
      const loaded = parseSave(serializeState(state));
      expect(loaded.status).toBe('loaded');
      expect(loaded.state).toEqual(state);
    });
  }
  it('uses a key of its own and the current version', () => {
    expect(SAVE_KEY).toBe('meltdown:save');
    expect(SAVE_KEY).not.toMatch(/hangtime/i);
    expect(JSON.parse(serializeState(createInitialState())).version).toBe(SAVE_VERSION);
  });
  it('saves through the store and loads it back', () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage);
    expect(store.load().status).toBe('fresh');
    const state = states().mid;
    store.save(state);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(createSaveStore(storage).load()).toEqual({ state, status: 'loaded' });
    store.clear();
    expect(store.load().status).toBe('fresh');
  });
});

describe('bad saves start fresh without throwing', () => {
  const fresh = createInitialState();
  it.each([
    ['not json', '{oops'],
    ['an array', '[]'],
    ['no version', JSON.stringify({ state: fresh })],
    ['a text version', JSON.stringify({ version: 'one', state: fresh })],
    ['a null state', JSON.stringify({ version: SAVE_VERSION, state: null })],
    ['a wrong phase', JSON.stringify({ version: SAVE_VERSION, state: { ...fresh, phase: 'party' } })],
  ])('%s', (_label, text) => {
    const r = parseSave(text);
    expect(r.state).toEqual(fresh);
    expect(r.status).toBe('corrupt');
  });

  it('a newer version is incompatible', () => {
    const r = parseSave(JSON.stringify({ version: SAVE_VERSION + 1, state: states().mid }));
    expect(r).toEqual({ state: fresh, status: 'incompatible' });
  });
  it('an old version with no migration is incompatible', () => {
    expect(parseSave(JSON.stringify({ version: 0, state: states().mid })).status).toBe('incompatible');
  });
  it('catches tampering: impossible rounds and mismatched history', () => {
    const mid = JSON.parse(serializeState(states().mid));
    const tamper = (fn: (s: any) => void) => {
      const copy = structuredClone(mid);
      fn(copy.state);
      return parseSave(JSON.stringify(copy)).status;
    };
    expect(tamper(() => {})).toBe('loaded');
    expect(tamper((s) => (s.round.guessed = ['P', 'P']))).toBe('corrupt');
    expect(tamper((s) => (s.round.guessed = ['1']))).toBe('corrupt');
    expect(tamper((s) => (s.round.guessed = ['X', 'Y', 'Z', 'Q']))).toBe('corrupt'); // lost round in play phase
    expect(tamper((s) => (s.round.puzzle.answer = '  sneaky   '))).toBe('corrupt');
    expect(tamper((s) => (s.round.puzzle.answer = 'привет'))).toBe('corrupt');
    expect(tamper((s) => (s.round.difficulty = 'impossible'))).toBe('corrupt');
    expect(tamper((s) => (s.round.guesser = 0))).toBe('corrupt');
    expect(tamper((s) => (s.round = null))).toBe('corrupt');
    expect(tamper((s) => (s.players[1].name = 'sam'))).toBe('corrupt');
    expect(tamper((s) => (s.players = [s.players[0]]))).toBe('corrupt');
    expect(tamper((s) => (s.matchLength = 'forever'))).toBe('corrupt');
    expect(tamper((s) => s.history.push({ setter: 0, guesser: 1, solved: true }))).toBe('corrupt');
    expect(tamper((s) => (s.phase = 'matchOver'))).toBe('corrupt');
  });
  it('rejects a result that disagrees with the history', () => {
    const r = JSON.parse(serializeState(states().result));
    r.state.history[0].solved = true;
    expect(parseSave(JSON.stringify(r)).status).toBe('corrupt');
  });
  it('validateState never throws on odd input', () => {
    for (const v of [undefined, null, 0, 'x', [], {}, { phase: 'play' }, { phase: 'setup', players: [{}], history: [], matchLength: 'one' }]) {
      expect(validateState(v)).toBeNull();
    }
  });
});

describe('migrations', () => {
  const v1 = () => JSON.stringify({ version: 1, state: states().setup });
  it('runs each step in order up to the current version', () => {
    const order: number[] = [];
    const migrations = {
      1: (s: unknown) => (order.push(1), { ...(s as object), matchLength: 'first3' }),
      2: (s: unknown) => (order.push(2), s),
    };
    const r = parseSave(v1(), 3, migrations);
    expect(order).toEqual([1, 2]);
    expect(r.status).toBe('loaded');
    expect(r.state.matchLength).toBe('first3');
  });
  it('a missing step is incompatible', () => {
    expect(parseSave(v1(), 3, { 2: (s) => s }).status).toBe('incompatible');
  });
  it('a throwing step is corrupt, not a crash', () => {
    const r = parseSave(v1(), 2, { 1: () => { throw new Error('boom'); } });
    expect(r).toEqual({ state: createInitialState(), status: 'corrupt' });
  });
  it('a migrated state is still validated', () => {
    expect(parseSave(v1(), 2, { 1: () => ({ phase: 'play' }) }).status).toBe('corrupt');
  });
  it('the real table is empty while there is only version 1', () => {
    expect(SAVE_VERSION).toBe(1);
    expect(Object.keys(MIGRATIONS)).toHaveLength(0);
  });
});

describe('unavailable storage', () => {
  function brokenStorage(): StorageLike {
    return {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
  }
  it('falls back to memory, keeps working and tells the UI once', () => {
    const onFallback = vi.fn();
    const store = createSaveStore(brokenStorage(), { onFallback });
    expect(store.load().status).toBe('fresh');
    expect(store.isPersistent()).toBe(false);
    const state = states().mid;
    store.save(state);
    store.save(state);
    expect(store.load()).toEqual({ state, status: 'loaded' });
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(() => store.clear()).not.toThrow();
  });
  it('falls back when only writing fails, keeping what was saved', () => {
    const real = createMemoryStorage();
    const onFallback = vi.fn();
    const store = createSaveStore({ ...real, getItem: real.getItem, removeItem: real.removeItem, setItem: () => { throw new Error('full'); } }, { onFallback });
    expect(store.isPersistent()).toBe(true);
    store.save(states().setup);
    expect(store.isPersistent()).toBe(false);
    expect(store.load().state).toEqual(states().setup);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });
  it('works with no storage at all and says so', async () => {
    const onFallback = vi.fn();
    const store = createSaveStore(null, { onFallback });
    expect(store.isPersistent()).toBe(false);
    store.save(states().setup);
    expect(store.load().status).toBe('loaded');
    await Promise.resolve();
    expect(onFallback).toHaveBeenCalledTimes(1);
  });
  it('reads a missing browser storage as null', () => {
    expect(getBrowserStorage()).toBeNull(); // the test environment has no localStorage
  });
});
