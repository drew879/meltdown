export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** Wrong guesses allowed at each difficulty. */
export const MISS_LIMITS: Record<Difficulty, number> = { easy: 8, normal: 6, hard: 4 };

/** Number of drawn melt stages after the fresh one: stages run 0 to MELT_STAGES. */
export const MELT_STAGES = 8;

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

/** Which of the nine melt pictures (0 fresh to 8 puddle) to show after `misses` of `limit`. */
export function meltStage(misses: number, limit: number): number {
  const clamped = Math.min(Math.max(misses, 0), limit);
  return Math.round((clamped * MELT_STAGES) / limit);
}
