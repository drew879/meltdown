import { answerToCells, lettersToFind, normalizeGuess, type Cell } from './answer';
import { MISS_LIMITS, meltStage, type Difficulty } from './difficulty';
import type { Puzzle } from './source';
import { fail, ok, type Result } from './types';

/**
 * One round. Only the facts are stored: misses, the outcome and the melt
 * stage are worked out from `guessed`, so they can never disagree with it.
 */
export interface Round {
  /** Index into the players list of the person guessing. */
  guesser: number;
  difficulty: Difficulty;
  puzzle: Puzzle;
  /** Letters guessed so far ('A'..'Z'), in order, no repeats. */
  guessed: string[];
}

export type RoundOutcome = 'playing' | 'won' | 'lost';

/** What a single guess did. */
export type GuessStatus = 'correct' | 'wrong' | 'repeat';

export function createRound(guesser: number, difficulty: Difficulty, puzzle: Puzzle): Round {
  return { guesser, difficulty, puzzle, guessed: [] };
}

export function missLimit(round: Round): number {
  return MISS_LIMITS[round.difficulty];
}

export function roundMisses(round: Round): number {
  const needed = new Set(lettersToFind(round.puzzle.answer));
  return round.guessed.filter((g) => !needed.has(g)).length;
}

export function correctLetters(round: Round): string[] {
  const needed = new Set(lettersToFind(round.puzzle.answer));
  return round.guessed.filter((g) => needed.has(g));
}

export function wrongLetters(round: Round): string[] {
  const needed = new Set(lettersToFind(round.puzzle.answer));
  return round.guessed.filter((g) => !needed.has(g));
}

export function roundOutcome(round: Round): RoundOutcome {
  if (roundMisses(round) >= missLimit(round)) return 'lost';
  const found = new Set(round.guessed);
  return lettersToFind(round.puzzle.answer).every((l) => found.has(l)) ? 'won' : 'playing';
}

export function missesLeft(round: Round): number {
  return Math.max(0, missLimit(round) - roundMisses(round));
}

/** Which melt picture to show: 0 (fresh) to 8 (puddle). */
export function roundMeltStage(round: Round): number {
  return meltStage(roundMisses(round), missLimit(round));
}

export interface ShownCell extends Cell {
  /** True for punctuation and spaces, and for letters already found. */
  revealed: boolean;
  /** Only when the answer is shown after a loss: this letter was never guessed. */
  missed: boolean;
}

/**
 * The answer as the sign shows it. Letters not yet found are hidden unless
 * `showAll` is set (used on loss), where unguessed letters come back marked `missed`.
 */
export function roundCells(round: Round, showAll = false): ShownCell[] {
  const found = new Set(round.guessed);
  return answerToCells(round.puzzle.answer).map((cell) => {
    if (cell.letter === null) return { ...cell, revealed: true, missed: false };
    const isFound = found.has(cell.letter);
    return { ...cell, revealed: isFound || showAll, missed: showAll && !isFound };
  });
}

/**
 * Apply a guess. A repeat or an unusable key gives back the same round
 * (a repeat is `ok` with status 'repeat'; a bad key is an error).
 */
export function applyGuess(round: Round, input: string): Result<{ round: Round; status: GuessStatus }> {
  if (roundOutcome(round) !== 'playing') {
    return fail('round-finished', 'This round is already over.');
  }
  const letter = normalizeGuess(input);
  if (letter === null) return fail('guess-invalid', 'Pick a letter from A to Z.');
  if (round.guessed.includes(letter)) return ok({ round, status: 'repeat' });
  const next: Round = { ...round, guessed: [...round.guessed, letter] };
  const hit = lettersToFind(round.puzzle.answer).includes(letter);
  return ok({ round: next, status: hit ? 'correct' : 'wrong' });
}
