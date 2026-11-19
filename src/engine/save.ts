import { validateAnswer } from './answer';
import { validateCategory } from './category';
import { isDifficulty } from './difficulty';
import {
  createInitialState,
  PHASES,
  type GameState,
  type Phase,
  type PlayerState,
} from './flow';
import { isMatchLength, matchStatus, rolesForRound, type RoundRecord } from './match';
import { validatePlayerNames } from './names';
import { applyGuess, createRound, roundOutcome, type Round } from './round';
import { createPersistence, type Persistence, type StorageLike } from './storage';
import { puzzleFromSetter } from './source';

/** A new key, so nothing collides with the older Hangtime game. */
export const SAVE_KEY = 'meltdown:save';

/** Bump when the saved shape changes, and add a migration below. */
export const SAVE_VERSION = 1;

interface Envelope {
  version: number;
  state: unknown;
}

/**
 * Migrations upgrade the `state` of a save by one version each.
 * `MIGRATIONS[n]` turns a version-n state into a version-(n+1) state, or
 * returns null if it cannot. Add an entry whenever SAVE_VERSION goes up.
 * Example: `MIGRATIONS[1] = (old) => ({ ...(old as object), newField: 0 })`.
 */
export const MIGRATIONS: Record<number, (state: unknown) => unknown> = {};

export type LoadStatus = 'loaded' | 'fresh' | 'corrupt' | 'incompatible';

export interface LoadResult {
  state: GameState;
  /**
   * 'loaded': a good save was restored. 'fresh': nothing saved.
   * 'corrupt' or 'incompatible': a save was found but dropped; play starts fresh.
   */
  status: LoadStatus;
}

export function serializeState(state: GameState): string {
  const envelope: Envelope = { version: SAVE_VERSION, state };
  return JSON.stringify(envelope);
}

export function parseSave(
  text: string | null,
  currentVersion: number = SAVE_VERSION,
  migrations: Record<number, (state: unknown) => unknown> = MIGRATIONS,
): LoadResult {
  const fresh = (status: LoadStatus): LoadResult => ({ state: createInitialState(), status });
  if (text === null) return fresh('fresh');
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    return fresh('corrupt');
  }
  if (!isRecord(envelope) || typeof envelope.version !== 'number' || !Number.isInteger(envelope.version)) {
    return fresh('corrupt');
  }
  let version = envelope.version;
  let state: unknown = envelope.state;
  if (version > currentVersion || version < 1) return fresh('incompatible');
  try {
    while (version < currentVersion) {
      const migrate = migrations[version];
      if (!migrate) return fresh('incompatible');
      state = migrate(state);
      version += 1;
    }
  } catch {
    return fresh('corrupt');
  }
  const valid = validateState(state);
  return valid ? { state: valid, status: 'loaded' } : fresh('corrupt');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check an unknown value really is a coherent game state and rebuild it
 * from validated pieces. Returns null if anything is off. Never throws.
 */
export function validateState(input: unknown): GameState | null {
  try {
    return validateStateUnsafe(input);
  } catch {
    return null;
  }
}

function validateStateUnsafe(input: unknown): GameState | null {
  if (!isRecord(input)) return null;
  const phase = input.phase;
  if (typeof phase !== 'string' || !(PHASES as readonly string[]).includes(phase)) return null;
  if (!isMatchLength(input.matchLength)) return null;
  if (!Array.isArray(input.players) || !Array.isArray(input.history)) return null;

  const matchLength = input.matchLength;
  const players: PlayerState[] = [];
  for (const p of input.players) {
    if (!isRecord(p) || typeof p.name !== 'string' || !isDifficulty(p.difficulty)) return null;
    players.push({ name: p.name, difficulty: p.difficulty });
  }
  const phaseName = phase as Phase;

  if (phaseName === 'names') {
    return players.length === 0 && input.history.length === 0 && input.round === null
      ? createInitialStateWith(matchLength)
      : null;
  }
  const names = validatePlayerNames(players.map((p) => p.name));
  if (!names.ok) return null;
  const cleanPlayers = players.map((p, i) => ({ ...p, name: names.value[i] }));
  if (cleanPlayers.some((p, i) => p.name !== players[i].name)) return null;
  const n = players.length;

  const history: RoundRecord[] = [];
  for (const [i, r] of input.history.entries()) {
    if (!isRecord(r) || typeof r.solved !== 'boolean') return null;
    const roles = rolesForRound(i, n);
    if (r.guesser !== roles.guesser) return null;
    if (r.setter !== roles.setter && r.setter !== null) return null;
    history.push({ setter: r.setter as number | null, guesser: roles.guesser, solved: r.solved });
  }

  // Which round index a live round belongs to.
  const roundIndex = phaseName === 'result' ? history.length - 1 : history.length;
  const needsRound = phaseName === 'handoff' || phaseName === 'play' || phaseName === 'result';
  let round: Round | null = null;
  if (needsRound) {
    if (roundIndex < 0) return null;
    round = validateRound(input.round, rolesForRound(roundIndex, n), n);
    if (!round) return null;
    const outcome = roundOutcome(round);
    if (phaseName === 'result') {
      const last = history[history.length - 1];
      if (outcome === 'playing' || last.solved !== (outcome === 'won')) return null;
    } else if (outcome !== 'playing') return null;
    if (phaseName === 'handoff' && round.guessed.length > 0) return null;
  } else if (input.round !== null) {
    return null;
  }

  const state: GameState = { phase: phaseName, players: cleanPlayers, matchLength, history, round };
  if (phaseName === 'matchOver' && !matchStatus(history, n, matchLength).over) return null;
  if (phaseName === 'setup' && matchStatus(history, n, matchLength).over) return null;
  return state;
}

function createInitialStateWith(matchLength: GameState['matchLength']): GameState {
  return { ...createInitialState(), matchLength };
}

function validateRound(
  input: unknown,
  roles: { setter: number; guesser: number },
  playerCount: number,
): Round | null {
  if (!isRecord(input) || !isDifficulty(input.difficulty) || !Array.isArray(input.guessed)) return null;
  if (input.guesser !== roles.guesser) return null;
  const puzzleIn = input.puzzle;
  if (!isRecord(puzzleIn) || typeof puzzleIn.answer !== 'string' || !isRecord(puzzleIn.category)) return null;
  const source = puzzleIn.source;
  if (!isRecord(source) || source.kind !== 'setter') return null;
  if (typeof source.setter !== 'number' || !Number.isInteger(source.setter)) return null;
  if (source.setter < 0 || source.setter >= playerCount || source.setter !== roles.setter) return null;
  const answer = validateAnswer(puzzleIn.answer);
  if (!answer.ok || answer.value.answer !== puzzleIn.answer) return null;
  const categoryIn = puzzleIn.category as { id?: unknown; custom?: unknown };
  const category = validateCategory({
    id: String(categoryIn.id),
    custom: typeof categoryIn.custom === 'string' ? categoryIn.custom : undefined,
  });
  if (!category.ok) return null;
  const puzzle = puzzleFromSetter({ answer: puzzleIn.answer, category: { id: category.value.id, custom: category.value.custom } }, source.setter);
  if (!puzzle.ok) return null;

  // Replay the guesses so a hand-edited save cannot reach an impossible round.
  let round = createRound(roles.guesser, input.difficulty, puzzle.value);
  for (const g of input.guessed) {
    if (typeof g !== 'string' || !/^[A-Z]$/.test(g)) return null;
    if (round.guessed.includes(g)) return null;
    const applied = applyGuess(round, g);
    if (!applied.ok) return null;
    round = applied.value.round;
  }
  return round;
}

// ----- The store the UI talks to -----

export interface SaveStore {
  load(): LoadResult;
  save(state: GameState): void;
  clear(): void;
  /** False after storage failed and saving moved to memory. Show a small, calm notice. */
  isPersistent(): boolean;
}

/**
 * Create the save store. Pass `getBrowserStorage()` in the app, a fake in
 * tests, or null for memory only. `onFallback` fires once if saving cannot
 * reach real storage.
 */
export function createSaveStore(
  storage: StorageLike | null,
  options: { key?: string; onFallback?: () => void } = {},
): SaveStore {
  const persistence: Persistence = createPersistence(options.key ?? SAVE_KEY, storage, options.onFallback);
  return {
    load: () => parseSave(persistence.read()),
    save: (state) => persistence.write(serializeState(state)),
    clear: () => persistence.remove(),
    isPersistent: () => persistence.isPersistent(),
  };
}
