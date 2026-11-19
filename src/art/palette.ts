// The whole game is painted from this one limited palette.
export const C = {
  ink: '#231942',

  snow: '#ffffff',
  snowShade: '#c6dcfb',
  puddle: '#d8ecff',
  drop: '#7fd4ff',

  sky: '#35b9f1',
  skyLow: '#98e2fa',
  skyHot: '#ffa53f',
  skyHotLow: '#fff0ad',
  cloud: '#ffffff',

  sea: '#17c6b9',
  seaDeep: '#0d9ea6',

  sand: '#ffe191',
  sandShade: '#f7c765',
  sandDark: '#e6ab4b',

  sun: '#ffd83d',
  sunShade: '#ffb829',
  sunHot: '#ff7a2c',
  ray: '#ffa22e',

  carrot: '#ff8a1f',
  carrotShade: '#e7670f',
  coral: '#ff5468',
  coralDeep: '#d63653',
  cream: '#fff5dc',
  hat: '#3d3482',
  hatLight: '#6258bd',
  twig: '#9c653c',
  blush: '#ffc4cf',
  leather: '#c9743c',
  leatherShade: '#a85a2b',
  mouth: '#5b1f3d',
} as const;

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Blend two palette colours. `t` is 0 for `a` and 1 for `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const k = Math.min(1, Math.max(0, t));
  const c = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `rgb(${c(ar, br)},${c(ag, bg)},${c(ab, bb)})`;
}
