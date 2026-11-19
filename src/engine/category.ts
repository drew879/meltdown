import { charLength, fail, ok, tidy, type Result } from './types';

export const CUSTOM_CATEGORY_MAX_LENGTH = 60;

export const CATEGORY_IDS = [
  'place',
  'animal',
  'person',
  'food-drink',
  'movie-tv',
  'job',
  'other',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  place: 'Place',
  animal: 'Animal',
  person: 'Person',
  'food-drink': 'Food & drink',
  'movie-tv': 'Movie or TV show',
  job: 'Job or occupation',
  other: 'Other',
};

/** A chosen category. `custom` is set only when `id` is "other". */
export interface Category {
  id: CategoryId;
  custom?: string;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function validateCategory(input: { id: string; custom?: string }): Result<Category> {
  if (!isCategoryId(input.id)) return fail('category-invalid', 'Pick a category from the list.');
  if (input.id !== 'other') return ok({ id: input.id });
  const custom = tidy(input.custom ?? '');
  if (custom.length === 0) return fail('category-custom-empty', 'Type a name for your category.');
  if (charLength(custom) > CUSTOM_CATEGORY_MAX_LENGTH) {
    return fail('category-custom-too-long', `Keep the category to ${CUSTOM_CATEGORY_MAX_LENGTH} characters or fewer.`);
  }
  return ok({ id: 'other', custom });
}

/** The words to show the guesser: the custom text for Other, else the list label. */
export function categoryLabel(category: Category): string {
  return category.id === 'other' && category.custom ? category.custom : CATEGORY_LABELS[category.id];
}
