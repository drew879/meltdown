// Words the screens use. Short, real sentences a new reader can read alone.
import { DIFFICULTIES, MISS_LIMITS, type Difficulty, type GameState } from '../engine';
import { currentMatchStatus, scores } from '../engine';

/** Picked at random in the brief, here by the round so a refresh shows the same one. */
export const LOSS_HEADINGS = [
  'OH DEAR!',
  'MY GOD!',
  "HE'S... GONE!",
  'R.I.P. SNOWMAN!',
  'WHAT HAVE YOU DONE!?',
  'SPLOOSH!',
  'BYE BYE!',
] as const;

export const WIN_HEADING = 'YOU GOT IT!';

/** A small, steady number from a round's answer and place in the match. */
export function roundSeed(answer: string, roundIndex: number): number {
  let h = 17 + roundIndex * 31;
  for (const ch of Array.from(answer)) h = (h * 33 + ch.codePointAt(0)!) % 100003;
  return h;
}

export function lossHeading(seed: number): string {
  return LOSS_HEADINGS[Math.abs(seed) % LOSS_HEADINGS.length]!;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export const difficultyList = DIFFICULTIES;

/** "6 wrong guesses" */
export function missesLabel(difficulty: Difficulty): string {
  const n = MISS_LIMITS[difficulty];
  return `${n} wrong guesses`;
}

export function pointsLabel(n: number): string {
  return `${n} ${n === 1 ? 'point' : 'points'}`;
}

/** What the winner line of the match-over screen says. */
export function matchOverLines(state: GameState): { heading: string; note: string } {
  const status = currentMatchStatus(state);
  const [a, b] = scores(state);
  const tally = `${state.players[0]!.name} ${a}, ${state.players[1]!.name} ${b}.`;
  if (status.over && status.winner !== null) {
    return { heading: `${state.players[status.winner]!.name} wins!`, note: tally };
  }
  return { heading: "It's a draw!", note: tally };
}
