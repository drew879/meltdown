// Where the melt's loose pieces come from. Each is a cut piece in public/art/
// once `npm run art` has cut the round 7 sheets (art/prompts/round-7-melt-pieces.md).
// Until a piece is in the manifest, a rough stand-in of the same name from
// melt-standins/ is used instead, so the real art only has to be dropped in.
// When all eleven are in, delete melt-standins/ and the stand-in half of this file.
import { art, manifest, type Piece } from './art';
import type { MeltPiece } from './melt-timeline';
import standins from './melt-standins/standins.json';

const standinUrls = import.meta.glob<string>('./melt-standins/*.{png,svg}', { eager: true, query: '?url', import: 'default' });

export interface PieceArt {
  src: string;
  /** its size in the cut art's pixels (the fresh snowman is 912 tall) */
  w: number;
  h: number;
  /** true while this is a stand-in, not the real drawing */
  standin: boolean;
}

export function meltPiece(name: MeltPiece): PieceArt {
  const cut = (manifest as Record<string, { w: number; h: number } | undefined>)[name];
  if (cut) return { src: art(name as Piece), w: cut.w, h: cut.h, standin: false };
  const file = Object.keys(standinUrls).find((path) => path.replace(/^.*\//, '').replace(/\.\w+$/, '') === name);
  const size = standins[name];
  return { src: file ? standinUrls[file]! : '', w: size.w, h: size.h, standin: true };
}
