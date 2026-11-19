import { validateAnswer } from './answer';
import { validateCategory, type Category } from './category';
import { type Result, ok } from './types';

/**
 * Where a puzzle comes from. Today a player types it. Later a word bank, a
 * daily puzzle or a shared link become new kinds here, and the rest of the
 * engine only ever sees a `Puzzle`.
 */
export type PuzzleSource =
  | { kind: 'setter'; setter: number };
// Future: { kind: 'word-bank'; listId: string } | { kind: 'daily'; date: string } | { kind: 'link' }

export interface Puzzle {
  /** The tidied answer, with its original characters. */
  answer: string;
  category: Category;
  source: PuzzleSource;
}

export interface TypedPuzzleInput {
  answer: string;
  category: { id: string; custom?: string };
}

/** Build a puzzle that one of the players typed in. */
export function puzzleFromSetter(input: TypedPuzzleInput, setter: number): Result<Puzzle> {
  const answer = validateAnswer(input.answer);
  if (!answer.ok) return answer;
  const category = validateCategory(input.category);
  if (!category.ok) return category;
  return ok({
    answer: answer.value.answer,
    category: category.value,
    source: { kind: 'setter', setter },
  });
}
