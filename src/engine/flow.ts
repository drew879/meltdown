import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from './difficulty';
import {
  DEFAULT_MATCH_LENGTH,
  isMatchLength,
  matchStatus,
  rolesForRound,
  scoresFromHistory,
  type MatchLength,
  type MatchStatus,
  type RoundRecord,
} from './match';
import { validatePlayerNames } from './names';
import {
  applyGuess,
  createRound,
  roundOutcome,
  type GuessStatus,
  type Round,
} from './round';
import { puzzleFromSetter, type TypedPuzzleInput } from './source';
import type { EngineError } from './types';

/**
 * Screen flow as an explicit state machine. A new mode is a new phase here
 * plus entries in PHASE_ACTIONS and a case in `reduce`.
 */
export const PHASES = ['names', 'setup', 'handoff', 'play', 'result', 'matchOver'] as const;
export type Phase = (typeof PHASES)[number];

export interface PlayerState {
  name: string;
  /** Their last choice as a setter, offered as the default next time. */
  difficulty: Difficulty;
}

export interface GameState {
  phase: Phase;
  players: PlayerState[];
  matchLength: MatchLength;
  /** One record per finished round. Its length is also the index of the next round. */
  history: RoundRecord[];
  /** The round being set up, played or just finished. Null in names, setup and matchOver. */
  round: Round | null;
}

export type Action =
  | { type: 'start'; names: string[]; matchLength: MatchLength }
  | { type: 'submitPuzzle'; puzzle: TypedPuzzleInput; difficulty: Difficulty }
  | { type: 'backToSetup' }
  | { type: 'confirmHandoff' }
  | { type: 'guess'; letter: string }
  | { type: 'continue' }
  | { type: 'rematch' }
  | { type: 'newSession' };

export type ActionType = Action['type'];

/** Which actions each phase accepts. Anything else is refused with `not-allowed`. */
export const PHASE_ACTIONS: Record<Phase, readonly ActionType[]> = {
  names: ['start', 'newSession'],
  setup: ['submitPuzzle', 'newSession'],
  handoff: ['confirmHandoff', 'backToSetup', 'newSession'],
  play: ['guess', 'newSession'],
  result: ['continue', 'newSession'],
  matchOver: ['rematch', 'newSession'],
};

export function createInitialState(): GameState {
  return { phase: 'names', players: [], matchLength: DEFAULT_MATCH_LENGTH, history: [], round: null };
}

export interface Reduction {
  state: GameState;
  /** Set when the action was refused. `state` is then the unchanged input. */
  error?: EngineError;
  /** Set after a `guess` action: what the guess did. */
  guess?: GuessStatus;
}

// ----- Selectors the screens can read -----

export function scores(state: GameState): number[] {
  return scoresFromHistory(state.history, state.players.length);
}

/** Index of the player who sets (or is about to set) the current round. */
export function currentSetter(state: GameState): number | null {
  if (state.players.length === 0) return null;
  const index = state.phase === 'result' ? state.history.length - 1 : state.history.length;
  return rolesForRound(Math.max(index, 0), state.players.length).setter;
}

export function currentGuesser(state: GameState): number | null {
  if (state.players.length === 0) return null;
  const index = state.phase === 'result' ? state.history.length - 1 : state.history.length;
  return rolesForRound(Math.max(index, 0), state.players.length).guesser;
}

/** The difficulty to pre-select on the setup screen: the setter's last choice. */
export function defaultDifficulty(state: GameState): Difficulty {
  const setter = currentSetter(state);
  return setter === null ? DEFAULT_DIFFICULTY : state.players[setter].difficulty;
}

export function currentMatchStatus(state: GameState): MatchStatus {
  return matchStatus(state.history, state.players.length, state.matchLength);
}

// ----- Transitions -----

function refuse(state: GameState, error: EngineError): Reduction {
  return { state, error };
}

export function reduce(state: GameState, action: Action): Reduction {
  if (!PHASE_ACTIONS[state.phase].includes(action.type)) {
    return refuse(state, { code: 'not-allowed', message: 'That cannot be done right now.' });
  }
  switch (action.type) {
    case 'newSession':
      return { state: createInitialState() };

    case 'start': {
      const names = validatePlayerNames(action.names);
      if (!names.ok) return refuse(state, names.error);
      if (!isMatchLength(action.matchLength)) {
        return refuse(state, { code: 'match-length-invalid', message: 'Pick how long the match should be.' });
      }
      return {
        state: {
          phase: 'setup',
          players: names.value.map((name) => ({ name, difficulty: DEFAULT_DIFFICULTY })),
          matchLength: action.matchLength,
          history: [],
          round: null,
        },
      };
    }

    case 'submitPuzzle': {
      if (!isDifficulty(action.difficulty)) {
        return refuse(state, { code: 'difficulty-invalid', message: 'Pick Easy, Normal or Hard.' });
      }
      const setter = currentSetter(state) as number;
      const guesser = currentGuesser(state) as number;
      const puzzle = puzzleFromSetter(action.puzzle, setter);
      if (!puzzle.ok) return refuse(state, puzzle.error);
      const players = state.players.map((p, i) => (i === setter ? { ...p, difficulty: action.difficulty } : p));
      return {
        state: {
          ...state,
          phase: 'handoff',
          players,
          round: createRound(guesser, action.difficulty, puzzle.value),
        },
      };
    }

    case 'backToSetup':
      return { state: { ...state, phase: 'setup', round: null } };

    case 'confirmHandoff':
      return { state: { ...state, phase: 'play' } };

    case 'guess': {
      const round = state.round;
      if (!round) return refuse(state, { code: 'not-allowed', message: 'There is no round to guess in.' });
      const applied = applyGuess(round, action.letter);
      if (!applied.ok) return refuse(state, applied.error);
      const { round: nextRound, status } = applied.value;
      const outcome = roundOutcome(nextRound);
      if (outcome === 'playing') {
        return { state: { ...state, round: nextRound }, guess: status };
      }
      const source = nextRound.puzzle.source;
      const record: RoundRecord = {
        setter: source.kind === 'setter' ? source.setter : null,
        guesser: nextRound.guesser,
        solved: outcome === 'won',
      };
      return {
        state: { ...state, phase: 'result', round: nextRound, history: [...state.history, record] },
        guess: status,
      };
    }

    case 'continue': {
      const next: GameState = { ...state, round: null };
      const over = matchStatus(state.history, state.players.length, state.matchLength).over;
      return { state: { ...next, phase: over ? 'matchOver' : 'setup' } };
    }

    case 'rematch':
      return { state: { ...state, phase: 'setup', history: [], round: null } };
  }
}
