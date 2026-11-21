// The backyard painting behind every screen. It is positioned so its grass
// line sits at `grassY`, and below the painting the page's own grass colour
// carries on.
import { art, manifest } from './art';

/** Where the fence meets the grass, as a fraction of the painting's height. */
const GRASS = 0.4975;

export function createYard(): HTMLImageElement {
  const img = new Image();
  img.className = 'pp-yard';
  img.alt = '';
  img.src = art('backyard');
  return img;
}

export function placeYard(yard: HTMLImageElement, grassY: number) {
  const W = innerWidth;
  const ar = manifest.backyard.h / manifest.backyard.w;
  let pw = W;
  let ph = W * ar;
  let top = grassY - ph * GRASS;
  if (top > 0) {
    ph = grassY / GRASS;
    pw = ph / ar;
    top = 0;
  }
  yard.style.width = `${pw}px`;
  yard.style.height = `${ph}px`;
  yard.style.left = `${W - pw}px`;
  yard.style.top = `${top}px`;
}
