/** Shared result and error types for the engine. Nothing here touches the DOM. */

export type ErrorCode =
  | 'name-empty'
  | 'name-too-long'
  | 'names-same'
  | 'player-count'
  | 'answer-empty'
  | 'answer-too-long'
  | 'word-too-long'
  | 'answer-no-letters'
  | 'answer-unsupported-letters'
  | 'category-invalid'
  | 'category-custom-empty'
  | 'category-custom-too-long'
  | 'difficulty-invalid'
  | 'match-length-invalid'
  | 'guess-invalid'
  | 'round-finished'
  | 'not-allowed';

/** A problem the UI can show as-is. `message` is short and friendly. */
export interface EngineError {
  code: ErrorCode;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: EngineError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: ErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

/** Collapse runs of whitespace to one space and trim the ends. */
export function tidy(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Length in characters as a person counts them (code points, not UTF-16 units). */
export function charLength(text: string): number {
  return Array.from(text).length;
}
