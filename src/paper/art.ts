// The cut paper pieces the game loads. The sizes come from the manifest that
// `npm run art` writes, so a new piece shows up here without editing this file.
import manifest from './art-manifest.json';

export { manifest };
export type Piece = keyof typeof manifest;

export const art = (name: Piece) => `${import.meta.env.BASE_URL}art/${name}.webp`;

export const snowmanPiece = (stage: number) => `snowman-${stage}` as Piece;

/** Warm the cache so swapping a piece in never flickers. */
export function preloadArt() {
  for (const name of Object.keys(manifest) as Piece[]) new Image().src = art(name);
}
