import { describe, expect, it } from 'vitest';
import {
  PHASE_ACTIONS,
  PHASES,
  createInitialState,
  currentGuesser,
  currentMatchStatus,
  currentSetter,
  defaultDifficulty,
  reduce,
  scores,
} from './flow';
import { guessAll, playRound, run, started, toPlay } from './helpers.test-util';
import { roundMeltStage } from './round';

describe('state machine', () => {
  it('walks names → setup → handoff → play → result → setup', () => {
    let s = createInitialState();
    expect(s.phase).toBe('names');
    s = run(s, { type: 'start', names: ['Sam', 'Dad'], matchLength: 'endless' });
    expect(s.phase).toBe('setup');
    s = run(s, { type: 'submitPuzzle', puzzle: { answer: 'cat', category: { id: 'animal' } }, difficulty: 'normal' });
    expect(s.phase).toBe('handoff');
    s = run(s, { type: 'confirmHandoff' });
    expect(s.phase).toBe('play');
    s = guessAll(s, 'CAT');
    expect(s.phase).toBe('result');
    s = run(s, { type: 'continue' });
    expect(s.phase).toBe('setup');
  });
  it('refuses actions the phase does not accept, without throwing', () => {
    for (const phase of PHASES) {
      const s = { ...createInitialState(), phase };
      const r = reduce(s, { type: 'guess', letter: 'a' });
      if (!PHASE_ACTIONS[phase].includes('guess')) {
        expect(r.error?.code).toBe('not-allowed');
        expect(r.state).toBe(s);
      }
    }
  });
  it('rejects bad names and match lengths and stays put', () => {
    const s = createInitialState();
    expect(reduce(s, { type: 'start', names: ['Sam', 'sam'], matchLength: 'endless' }).error?.code).toBe('names-same');
    expect(reduce(s, { type: 'start', names: ['Sam', 'Dad'], matchLength: 'first9' as never }).error?.code).toBe('match-length-invalid');
  });
  it('keeps the secret in setup when it is invalid', () => {
    const s = started();
    const r = reduce(s, { type: 'submitPuzzle', puzzle: { answer: '???', category: { id: 'animal' } }, difficulty: 'normal' });
    expect(r.error?.code).toBe('answer-no-letters');
    expect(r.state).toBe(s);
    const c = reduce(s, { type: 'submitPuzzle', puzzle: { answer: 'cat', category: { id: 'other' } }, difficulty: 'normal' });
    expect(c.error?.code).toBe('category-custom-empty');
    const d = reduce(s, { type: 'submitPuzzle', puzzle: { answer: 'cat', category: { id: 'animal' } }, difficulty: 'nightmare' as never });
    expect(d.error?.code).toBe('difficulty-invalid');
  });
  it('can step back from handoff to setup', () => {
    const s = run(started(), { type: 'submitPuzzle', puzzle: { answer: 'cat', category: { id: 'animal' } }, difficulty: 'easy' });
    const back = run(s, { type: 'backToSetup' });
    expect(back.phase).toBe('setup');
    expect(back.round).toBeNull();
  });
  it('new session clears names, scores and the round from any phase', () => {
    let s = toPlay(started(), 'cat');
    s = guessAll(s, 'CA');
    for (const phase of ['play'] as const) expect(s.phase).toBe(phase);
    const cleared = run(s, { type: 'newSession' });
    expect(cleared).toEqual(createInitialState());
    const done = playRound(started(), true);
    expect(run(done, { type: 'newSession' })).toEqual(createInitialState());
  });
  it('exposes the melt stage while playing', () => {
    let s = toPlay(started(), 'cat', 'hard');
    s = guessAll(s, 'XQ');
    expect(roundMeltStage(s.round!)).toBe(4);
  });
  it('reports each guess status', () => {
    const s = toPlay(started(), 'cat');
    expect(reduce(s, { type: 'guess', letter: 'c' }).guess).toBe('correct');
    expect(reduce(s, { type: 'guess', letter: 'z' }).guess).toBe('wrong');
    const once = run(s, { type: 'guess', letter: 'z' });
    const twice = reduce(once, { type: 'guess', letter: 'Z' });
    expect(twice.guess).toBe('repeat');
    expect(twice.state.round).toBe(once.round);
    expect(reduce(s, { type: 'guess', letter: '9' }).error?.code).toBe('guess-invalid');
  });
});

describe('roles and scoring', () => {
  it('player one sets first and roles swap every round', () => {
    let s = started();
    const seen: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      seen.push([currentSetter(s)!, currentGuesser(s)!]);
      s = run(playRound(s, true), { type: 'continue' });
    }
    expect(seen).toEqual([[0, 1], [1, 0], [0, 1], [1, 0]]);
  });
  it('solving earns the guesser one point at every difficulty', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const s = playRound(started(), true, d);
      expect(scores(s)).toEqual([0, 1]);
    }
  });
  it('stumping the guesser earns nothing', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const s = playRound(started(), false, d);
      expect(s.phase).toBe('result');
      expect(scores(s)).toEqual([0, 0]);
    }
  });
  it('keeps the right names on the right scores', () => {
    let s = run(playRound(started(), true), { type: 'continue' });
    s = playRound(s, true);
    expect(scores(s)).toEqual([1, 1]);
    expect(s.players.map((p) => p.name)).toEqual(['Sam', 'Dad']);
  });
});

describe('remembered difficulty', () => {
  it('defaults to normal, then each setter gets their own last choice', () => {
    let s = started();
    expect(defaultDifficulty(s)).toBe('normal');
    s = run(playRound(s, true, 'hard'), { type: 'continue' }); // Sam set on hard
    expect(defaultDifficulty(s)).toBe('normal'); // Dad has not chosen yet
    s = run(playRound(s, true, 'easy'), { type: 'continue' }); // Dad set on easy
    expect(defaultDifficulty(s)).toBe('hard'); // Sam again
    s = run(playRound(s, true, 'normal'), { type: 'continue' });
    expect(defaultDifficulty(s)).toBe('easy');
  });
  it('is kept through a rematch and cleared by a new session', () => {
    let s = started('one');
    s = run(playRound(s, true, 'hard'), { type: 'continue' });
    s = run(playRound(s, true, 'easy'), { type: 'continue' });
    expect(s.phase).toBe('matchOver');
    s = run(s, { type: 'rematch' });
    expect(defaultDifficulty(s)).toBe('hard');
    expect(defaultDifficulty(run(s, { type: 'newSession' }))).toBe('normal');
  });
});

describe('match lengths', () => {
  function play(length: 'endless' | 'one' | 'first2' | 'first3', results: boolean[]) {
    let s = started(length);
    for (const solved of results) {
      s = run(playRound(s, solved), { type: 'continue' });
    }
    return s;
  }
  // results are in round order: round 1 is Dad guessing... Sam sets so Dad (1) guesses, then Sam (0), and so on.

  it('endless never ends', () => {
    const s = play('endless', Array(20).fill(true));
    expect(s.phase).toBe('setup');
    expect(currentMatchStatus(s)).toEqual({ over: false });
  });

  it('1 game: both guess once, higher score wins', () => {
    const s = play('one', [true, false]); // Dad solves, Sam fails
    expect(s.phase).toBe('matchOver');
    expect(currentMatchStatus(s)).toEqual({ over: true, winner: 1 });
  });
  it('1 game is not over after only one guess', () => {
    let s = started('one');
    s = playRound(s, true);
    expect(s.phase).toBe('result');
    expect(currentMatchStatus(s)).toEqual({ over: false });
    expect(run(s, { type: 'continue' }).phase).toBe('setup');
  });
  it('1 game ties are a draw, including 0 to 0', () => {
    for (const results of [[true, true], [false, false]]) {
      const s = play('one', results);
      expect(s.phase).toBe('matchOver');
      expect(currentMatchStatus(s)).toEqual({ over: true, winner: null, draw: true });
    }
  });

  it('first to 2: a player reaching 2 does not win mid-pair', () => {
    // Dad solves rounds 1 and 3; Sam fails round 2. After round 3 Dad has 2, Sam has 0, but Sam still gets his turn.
    let s = play('first2', [true, false, true]);
    expect(s.phase).toBe('setup');
    expect(currentMatchStatus(s)).toEqual({ over: false });
    s = run(playRound(s, false), { type: 'continue' });
    expect(s.phase).toBe('matchOver');
    expect(currentMatchStatus(s)).toEqual({ over: true, winner: 1 });
  });
  it('first to 2: a lead with a full pair ends the match', () => {
    const s = play('first2', [true, false, true, false]);
    expect(currentMatchStatus(s)).toEqual({ over: true, winner: 1 });
    expect(scores(s)).toEqual([0, 2]);
  });
  it('first to 2: the player who is behind can catch up in the last turn and force a tie-break', () => {
    // Dad solves 1 and 3, Sam solves 2 and 4: 2 to 2, so play on.
    let s = play('first2', [true, true, true, true]);
    expect(s.phase).toBe('setup');
    expect(scores(s)).toEqual([2, 2]);
    // Tie-break pair: Dad solves, Sam fails → Dad leads 3 to 2 → over.
    s = play('first2', [true, true, true, true, true, false]);
    expect(currentMatchStatus(s)).toEqual({ over: true, winner: 1 });
  });
  it('first to 2: tie-break pairs repeat until one leads', () => {
    let s = play('first2', [true, true, true, true, true, true, true, true]);
    expect(s.phase).toBe('setup'); // 4 to 4
    s = play('first2', [true, true, true, true, true, true, false, true]);
    expect(currentMatchStatus(s)).toEqual({ over: true, winner: 0 });
  });
  it('first to 2: both reaching the target in one pair does not end it', () => {
    const s = play('first2', [true, false, true, true]);
    expect(scores(s)).toEqual([1, 2]);
    expect(s.phase).toBe('matchOver'); // Dad 2, Sam 1: Dad leads
  });
  it('first to 2 with a low-scoring game keeps going until someone gets there', () => {
    const s = play('first2', [true, false, false, false, false, false]);
    expect(s.phase).toBe('setup');
    expect(scores(s)).toEqual([0, 1]);
  });

  it('first to 3 needs 3 and a lead at the end of a pair', () => {
    let s = play('first3', [true, false, true, false, true, false]);
    expect(currentMatchStatus(s)).toEqual({ over: true, winner: 1 });
    s = play('first3', [true, true, true, true, true, true]);
    expect(s.phase).toBe('setup'); // 3 to 3
    s = play('first3', [true, true, true, true, true, true, false, true]);
    expect(currentMatchStatus(s)).toEqual({ over: true, winner: 0 });
  });
  it('first to 3 is not over at 2 to 0', () => {
    expect(play('first3', [true, false, true, false]).phase).toBe('setup');
  });

  it('rematch keeps names and starts the scores again', () => {
    let s = play('one', [true, false]);
    s = run(s, { type: 'rematch' });
    expect(s.phase).toBe('setup');
    expect(s.players.map((p) => p.name)).toEqual(['Sam', 'Dad']);
    expect(scores(s)).toEqual([0, 0]);
    expect(currentSetter(s)).toBe(0);
  });
});
