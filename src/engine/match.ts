export const MATCH_LENGTHS = ['endless', 'one', 'first2', 'first3'] as const;
export type MatchLength = (typeof MATCH_LENGTHS)[number];

export const DEFAULT_MATCH_LENGTH: MatchLength = 'endless';

export const MATCH_LENGTH_LABELS: Record<MatchLength, string> = {
  endless: 'Endless',
  one: '1 game',
  first2: 'First to 2',
  first3: 'First to 3',
};

export function isMatchLength(value: unknown): value is MatchLength {
  return typeof value === 'string' && (MATCH_LENGTHS as readonly string[]).includes(value);
}

/** The score a player must reach to win. Endless has none. */
export const MATCH_TARGETS: Record<MatchLength, number | null> = {
  endless: null,
  one: 1,
  first2: 2,
  first3: 3,
};

/** What happened in one finished round. */
export interface RoundRecord {
  /** Who set the puzzle, or null when it did not come from a player. */
  setter: number | null;
  guesser: number;
  solved: boolean;
}

/** Who sets and who guesses in round `roundIndex` (0 first). Roles rotate each round. */
export function rolesForRound(roundIndex: number, playerCount: number): { setter: number; guesser: number } {
  const setter = roundIndex % playerCount;
  return { setter, guesser: (setter + 1) % playerCount };
}

/** A point only for solving. Stumping the guesser earns nothing. */
export function scoresFromHistory(history: readonly RoundRecord[], playerCount: number): number[] {
  const scores = new Array<number>(playerCount).fill(0);
  for (const record of history) if (record.solved) scores[record.guesser] += 1;
  return scores;
}

export type MatchStatus =
  | { over: false }
  | { over: true; winner: number }
  | { over: true; winner: null; draw: true };

/**
 * Is the match finished? Players always get the same number of guessing
 * turns, so a match can only end once a full set of rounds (one guess each)
 * is done. Then:
 *  - Endless never ends.
 *  - "1 game" ends after the first full set: the higher score wins, a tie is a draw.
 *  - "First to N" ends at the end of a full set when someone has N or more
 *    and strictly leads. If the top score is shared, another set is played.
 */
export function matchStatus(
  history: readonly RoundRecord[],
  playerCount: number,
  length: MatchLength,
): MatchStatus {
  const target = MATCH_TARGETS[length];
  if (target === null) return { over: false };
  if (history.length === 0 || history.length % playerCount !== 0) return { over: false };
  const scores = scoresFromHistory(history, playerCount);
  const top = Math.max(...scores);
  const leaders = scores.flatMap((s, i) => (s === top ? [i] : []));
  if (length === 'one') {
    return leaders.length === 1 ? { over: true, winner: leaders[0] } : { over: true, winner: null, draw: true };
  }
  if (top >= target && leaders.length === 1) return { over: true, winner: leaders[0] };
  return { over: false };
}
