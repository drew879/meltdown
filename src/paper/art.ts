// The cut paper pieces the game loads. The sizes come from the manifest that
// `npm run art` writes, so a new piece shows up here without editing this file.
import manifest from './art-manifest.json';
import { CELEBRATION_PIECES } from './celebration-timeline';
import { MELT_PIECES } from './melt-timeline';

export { manifest };
export type Piece = keyof typeof manifest;

export const art = (name: Piece) => `${import.meta.env.BASE_URL}art/${name}.webp`;

export const snowmanPiece = (stage: number) => `snowman-${stage}` as Piece;

/** The win celebration's pictures and the melt's loose pieces: fetched when the play screen is up, not on every first load. */
const WIN_ONLY = new Set<string>([...CELEBRATION_PIECES, ...MELT_PIECES]);

/** Warm the cache so swapping a piece in never flickers. */
export function preloadArt() {
  for (const name of Object.keys(manifest) as Piece[]) if (!WIN_ONLY.has(name)) new Image().src = art(name);
}
