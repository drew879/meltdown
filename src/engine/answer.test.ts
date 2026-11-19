import { describe, expect, it } from 'vitest';
import { ANSWER_MAX_LENGTH, WORD_MAX_LENGTH, foldLetter, lettersToFind, normalizeGuess, validateAnswer } from './answer';
import { validatePlayerNames } from './names';
import { validateCategory, categoryLabel, CATEGORY_IDS } from './category';

describe('player names', () => {
  it('accepts two different names and tidies them', () => {
    const r = validatePlayerNames(['  Sam ', 'Dad   B']);
    expect(r).toEqual({ ok: true, value: ['Sam', 'Dad B'] });
  });
  it('rejects empty names', () => {
    const r = validatePlayerNames(['Sam', '   ']);
    expect(!r.ok && r.error.code).toBe('name-empty');
  });
  it('allows exactly 24 characters and rejects 25', () => {
    expect(validatePlayerNames(['a'.repeat(24), 'b']).ok).toBe(true);
    const r = validatePlayerNames(['a'.repeat(25), 'b']);
    expect(!r.ok && r.error.code).toBe('name-too-long');
  });
  it('rejects names that match ignoring case', () => {
    const r = validatePlayerNames(['Sam', 'sAM']);
    expect(!r.ok && r.error.code).toBe('names-same');
  });
  it('needs the right number of players', () => {
    const r = validatePlayerNames(['Sam']);
    expect(!r.ok && r.error.code).toBe('player-count');
  });
});

describe('answer validation', () => {
  it('trims and collapses whitespace', () => {
    const r = validateAnswer('  polar   bear \n');
    expect(r.ok && r.value.answer).toBe('polar bear');
  });
  it('limits the answer to ANSWER_MAX_LENGTH characters', () => {
    expect(ANSWER_MAX_LENGTH).toBe(60);
    const ok60 = ('abcdefghi ').repeat(6).trim() + 'a'.repeat(60 - 59);
    expect(Array.from(ok60).length).toBe(60);
    expect(validateAnswer(ok60).ok).toBe(true);
    const r = validateAnswer(ok60 + 'a');
    expect(!r.ok && r.error.code).toBe('answer-too-long');
  });
  it('limits single words to 24 characters', () => {
    expect(validateAnswer('a'.repeat(WORD_MAX_LENGTH)).ok).toBe(true);
    const r = validateAnswer('hi ' + 'a'.repeat(WORD_MAX_LENGTH + 1));
    expect(!r.ok && r.error.code).toBe('word-too-long');
  });
  it('needs at least one letter', () => {
    const r = validateAnswer('123 !?');
    expect(!r.ok && r.error.code).toBe('answer-no-letters');
    expect(validateAnswer('   ').ok).toBe(false);
  });
  it('shows spaces, numbers and punctuation without guessing', () => {
    const r = validateAnswer('Mr. T 2');
    expect(r.ok && r.value.cells.filter((c) => c.letter).map((c) => c.letter)).toEqual(['M', 'R', 'T']);
    expect(r.ok && lettersToFind(r.value.answer)).toEqual(['M', 'R', 'T']);
  });
  it('folds common accents to their base letter', () => {
    expect(foldLetter('é')).toBe('E');
    expect(foldLetter('Ñ')).toBe('N');
    expect(foldLetter('ü')).toBe('U');
    const r = validateAnswer('café');
    expect(r.ok && lettersToFind(r.value.answer)).toEqual(['A', 'C', 'E', 'F']);
    expect(r.ok && r.value.cells[3]).toEqual({ char: 'é', letter: 'E' });
  });
  it('folds decomposed accents too', () => {
    expect(foldLetter('é')).toBe('E');
    expect(validateAnswer('café').ok).toBe(true);
  });
  it('rejects other alphabets with a friendly message', () => {
    for (const text of ['привет', 'こんにちは', 'cat кот', 'ΑΒΓ']) {
      const r = validateAnswer(text);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error.code).toBe('answer-unsupported-letters');
      expect(!r.ok && r.error.message).toMatch(/A to Z/);
    }
  });
  it('rejects Latin letters that do not fold to one letter', () => {
    expect(validateAnswer('straße').ok).toBe(false);
  });
  it('counts accented input as guesses', () => {
    expect(normalizeGuess('é')).toBe('E');
    expect(normalizeGuess('e')).toBe('E');
    expect(normalizeGuess('1')).toBeNull();
    expect(normalizeGuess('ab')).toBeNull();
    expect(normalizeGuess('')).toBeNull();
    expect(normalizeGuess('я')).toBeNull();
  });
});

describe('category', () => {
  it('accepts every listed category', () => {
    for (const id of CATEGORY_IDS.filter((c) => c !== 'other')) {
      expect(validateCategory({ id })).toEqual({ ok: true, value: { id } });
    }
  });
  it('drops custom text for listed categories', () => {
    expect(validateCategory({ id: 'place', custom: 'junk' })).toEqual({ ok: true, value: { id: 'place' } });
  });
  it('needs custom text for Other, up to 60 characters', () => {
    const empty = validateCategory({ id: 'other', custom: '  ' });
    expect(!empty.ok && empty.error.code).toBe('category-custom-empty');
    expect(validateCategory({ id: 'other', custom: 'x'.repeat(60) }).ok).toBe(true);
    const long = validateCategory({ id: 'other', custom: 'x'.repeat(61) });
    expect(!long.ok && long.error.code).toBe('category-custom-too-long');
  });
  it('rejects unknown ids and labels categories', () => {
    const r = validateCategory({ id: 'vegetable' });
    expect(!r.ok && r.error.code).toBe('category-invalid');
    expect(categoryLabel({ id: 'food-drink' })).toBe('Food & drink');
    expect(categoryLabel({ id: 'other', custom: 'Board games' })).toBe('Board games');
  });
});
