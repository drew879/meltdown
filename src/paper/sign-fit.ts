// How the answer is laid out on the garden sign: how many rows, how big the
// letters, and which of the three board pictures fits best. Pure maths, so it
// does not touch the page.
import { manifest, type Piece } from './art';

/** The sign holds at most this many rows. */
export const MAX_ROWS = 3;
/** A sign never gets thinner than this, however small its letters. */
const MIN_BOARD = 40;
/** A gap between words, in letter-widths. */
const SPACE = 0.6;

/** The biggest a letter gets. Shorter screens get a smaller cap, so the sign leaves room for the snowman. */
const maxSlot = (viewportHeight: number) => Math.max(20, Math.min(38, viewportHeight * 0.04));

/**
 * Three pictures of the same board, from long and low to nearly square.
 * `end` is how much of the picture's width each ragged end takes.
 */
const SIGNS: { piece: Piece; end: number }[] = [
  { piece: 'sign-1', end: 0.11 },
  { piece: 'sign-2', end: 0.11 },
  { piece: 'sign-3', end: 0.11 },
];

export interface Fit {
  /** Width of one letter, in pixels. */
  slot: number;
  rows: string[][];
  width: number;
  height: number;
  /** Width of each end of the board, in pixels. */
  end: number;
  sign: (typeof SIGNS)[number];
}

const rowWidth = (row: string[]) => row.reduce((n, w) => n + [...w].length, 0) + SPACE * (row.length - 1);

/** Split the words into exactly `count` rows so that the longest row is as short as possible. */
function split(words: string[], count: number): string[][] {
  let best: string[][] = [words];
  let bestWidth = Infinity;
  const go = (start: number, left: number, rows: string[][]) => {
    if (left === 1) {
      const all = [...rows, words.slice(start)];
      const widest = Math.max(...all.map(rowWidth));
      if (widest < bestWidth) {
        bestWidth = widest;
        best = all;
      }
      return;
    }
    for (let end = start + 1; end <= words.length - (left - 1); end++) go(end, left - 1, [...rows, words.slice(start, end)]);
  };
  go(0, count, []);
  return best;
}

/** The biggest letters these rows can have on a sign no wider than `maxWidth`. */
function fitRows(rows: string[][], maxWidth: number, viewportHeight: number): Fit {
  const across = Math.max(...rows.map(rowWidth), 4.5) + 0.9; // letters, plus a little air
  const tall = 1.6 * rows.length + (rows.length === 1 ? 1.55 : 1.2); // rows, plus plain wood above and below
  let best: Fit | null = null;
  let bestScore = -Infinity;
  for (const sign of SIGNS) {
    const img = manifest[sign.piece];
    const endPerHeight = (sign.end * img.w) / img.h; // the ends keep their shape, so they grow with the height
    let slot = Math.min(maxSlot(viewportHeight), maxWidth / (across + 2 * tall * endPerHeight));
    if (slot * tall < MIN_BOARD) slot = Math.min(slot, (maxWidth - 2 * MIN_BOARD * endPerHeight) / across);
    slot = Math.floor(slot * 2) / 2;
    const height = Math.max(slot * tall, MIN_BOARD);
    const end = height * endPerHeight;
    const inner = slot * across;
    // how far the plain middle of the board is stretched from its natural shape
    const natural = height * (img.w / img.h) * (1 - 2 * sign.end);
    const stretch = Math.abs(Math.log(inner / natural));
    // bigger letters are better, unless the wood has to be pulled far out of shape
    const score = slot - Math.max(0, stretch - 0.6) * 40;
    if (score > bestScore) {
      bestScore = score;
      best = { slot, rows, width: inner + 2 * end, height, end, sign };
    }
  }
  return best!;
}

/**
 * Lay the answer out on the sign. Fewer rows are preferred as long as the
 * letters stay big: a short answer sits on one row, and a 45-character title
 * steps down to smaller letters on three.
 */
export function fitAnswer(answer: string, maxWidth: number, viewportHeight: number): Fit {
  const words = answer.split(' ');
  const k = Math.min(1, maxWidth / 400);
  const worth = [30 * k, 26 * k]; // letters this big are worth keeping on one row, or on two
  let best: Fit | null = null;
  for (let count = 1; count <= Math.min(MAX_ROWS, words.length); count++) {
    const fit = fitRows(split(words, count), maxWidth, viewportHeight);
    if (count <= worth.length && fit.slot >= worth[count - 1]!) return fit;
    if (!best || fit.slot > best.slot) best = fit;
  }
  return best!;
}
