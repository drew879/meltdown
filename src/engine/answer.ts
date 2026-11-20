import { charLength, fail, ok, tidy, type Result } from './types';

/** Longest answer in characters (lowered from 60 on 2026-11-20). */
export const ANSWER_MAX_LENGTH = 45;
/** Longest single word, so it fits on the sign. */
export const WORD_MAX_LENGTH = 24;

/** One character of the answer as the sign shows it. */
export interface Cell {
  /** The character as typed, for display. */
  char: string;
  /** The A to Z letter to guess ('A'..'Z'), or null for spaces, digits and punctuation. */
  letter: string | null;
}

const OTHER_ALPHABET_MESSAGE =
  'This game uses the letters A to Z. Try a word without other alphabets.';

/**
 * Fold one character to its A to Z base letter, or null when it is not a
 * letter the game can use. "é" gives "E". Returns 'other' for letters of a
 * kind we cannot guess (other alphabets, and Latin letters that do not fold to
 * a single letter such as "ß" or "æ"), and null for non-letters.
 */
export function foldLetter(char: string): string | 'other' | null {
  const base = char.normalize('NFD').replace(/\p{M}/gu, '');
  if (/^[A-Za-z]$/u.test(base)) return base.toUpperCase();
  if (/^\p{L}$/u.test(char) || /\p{L}/u.test(base)) return 'other';
  return null;
}

/** Turn a typed guess (a letter key, maybe accented or lowercase) into 'A'..'Z', or null. */
export function normalizeGuess(input: string): string | null {
  const one = Array.from(input.trim());
  if (one.length !== 1) return null;
  const folded = foldLetter(one[0]);
  return folded && folded !== 'other' ? folded : null;
}

/**
 * Validate a typed answer. On success the value is the tidied answer and the
 * cells the sign should show.
 */
export function validateAnswer(raw: string): Result<{ answer: string; cells: Cell[] }> {
  const answer = tidy(raw);
  if (answer.length === 0) return fail('answer-empty', 'Type a secret answer first.');
  if (charLength(answer) > ANSWER_MAX_LENGTH) {
    return fail('answer-too-long', `Keep it to ${ANSWER_MAX_LENGTH} characters or fewer.`);
  }
  for (const word of answer.split(' ')) {
    if (charLength(word) > WORD_MAX_LENGTH) {
      return fail('word-too-long', `One word is too long. Words can be up to ${WORD_MAX_LENGTH} letters.`);
    }
  }
  const cells = answerToCells(answer);
  for (const char of Array.from(answer)) {
    if (foldLetter(char) === 'other') return fail('answer-unsupported-letters', OTHER_ALPHABET_MESSAGE);
  }
  if (!cells.some((c) => c.letter !== null)) {
    return fail('answer-no-letters', 'Add at least one letter from A to Z.');
  }
  return ok({ answer, cells });
}

/** Split an already-valid answer into cells. */
export function answerToCells(answer: string): Cell[] {
  return Array.from(answer).map((char) => {
    const folded = foldLetter(char);
    return { char, letter: folded && folded !== 'other' ? folded : null };
  });
}

/** The distinct letters a guesser has to find, in A to Z order. */
export function lettersToFind(answer: string): string[] {
  const set = new Set<string>();
  for (const cell of answerToCells(answer)) if (cell.letter) set.add(cell.letter);
  return [...set].sort();
}
