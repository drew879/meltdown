import { createInitialState, reduce, type Action, type GameState } from './flow';

/** Run an action and fail loudly if the engine refused it. */
export function run(state: GameState, action: Action): GameState {
  const r = reduce(state, action);
  if (r.error) throw new Error(`${action.type} refused: ${r.error.code}`);
  return r.state;
}

export function started(matchLength: 'endless' | 'one' | 'first2' | 'first3' = 'endless'): GameState {
  return run(createInitialState(), { type: 'start', names: ['Sam', 'Dad'], matchLength });
}

/** Set a puzzle from setup through the handoff, ready to guess. */
export function toPlay(state: GameState, answer: string, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): GameState {
  const s = run(state, { type: 'submitPuzzle', puzzle: { answer, category: { id: 'animal' } }, difficulty });
  return run(s, { type: 'confirmHandoff' });
}

export function guessAll(state: GameState, letters: string): GameState {
  let s = state;
  for (const letter of letters) s = run(s, { type: 'guess', letter });
  return s;
}

/** Play one whole round where the guesser solves it (answer "A") or fails. */
export function playRound(state: GameState, solved: boolean, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): GameState {
  let s = toPlay(state, 'A', difficulty);
  s = solved ? guessAll(s, 'A') : guessAll(s, 'BCDEFGHI'.slice(0, { easy: 8, normal: 6, hard: 4 }[difficulty]));
  return s;
}
