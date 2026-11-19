import { charLength, fail, ok, tidy, type Result } from './types';

export const NAME_MAX_LENGTH = 24;
/** The pass-and-play mode is for two people. The engine itself works for any count. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 2;

/**
 * Check a list of player names. Each is trimmed and has repeated spaces
 * collapsed, then must be 1 to 24 characters. No two may match ignoring case.
 */
export function validatePlayerNames(names: readonly string[]): Result<string[]> {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    return fail('player-count', `This game needs ${MIN_PLAYERS === MAX_PLAYERS ? MIN_PLAYERS : `${MIN_PLAYERS} to ${MAX_PLAYERS}`} players.`);
  }
  const cleaned: string[] = [];
  for (const raw of names) {
    const name = tidy(String(raw));
    if (name.length === 0) return fail('name-empty', 'Everyone needs a name.');
    if (charLength(name) > NAME_MAX_LENGTH) {
      return fail('name-too-long', `Names can be up to ${NAME_MAX_LENGTH} letters long.`);
    }
    cleaned.push(name);
  }
  const seen = new Set<string>();
  for (const name of cleaned) {
    const key = name.toLowerCase();
    if (seen.has(key)) return fail('names-same', 'Pick two different names so we can tell you apart.');
    seen.add(key);
  }
  return ok(cleaned);
}
