import { describe, expect, it } from 'vitest';
import { MAX_ROWS, fitAnswer } from './sign-fit';

const LONGEST = 'Indiana Jones and the Raiders of the Lost Ark'; // 45 characters
const WIDEST_WORD = 'Supercalifragilisticexpi'; // 24 letters

describe('fitting the answer on the sign', () => {
  it('keeps a short answer on one row with big letters', () => {
    const fit = fitAnswer('Polar Bear', 400, 956);
    expect(fit.rows).toHaveLength(1);
    expect(fit.slot).toBeGreaterThanOrEqual(30);
  });

  it.each([
    [LONGEST, 320, 568],
    [LONGEST, 440, 956],
    [WIDEST_WORD, 320, 568],
    ['A', 320, 568],
  ])('fits "%s" inside %i px on at most three rows', (answer, width, height) => {
    const maxWidth = width - 40;
    const fit = fitAnswer(answer, maxWidth, height);
    expect(fit.rows.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(fit.rows.flat().join(' ')).toBe(answer);
    expect(fit.width).toBeLessThanOrEqual(maxWidth + 1);
    expect(fit.slot).toBeGreaterThan(9);
  });
});
