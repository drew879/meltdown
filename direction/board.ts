// The Phase 1 direction board. Not part of the shipped game.
import '../src/ui/theme.css';
import '../src/ui/play.css';
import './board.css';
import { C } from '../src/art/palette';
import { drawMelvin } from '../src/art/melvin';
import { drawRay } from '../src/art/ray';
import { fitCanvas, mountScene } from '../src/art/scene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// hero and live scenes
mountScene($<HTMLCanvasElement>('hero'), () => ({ limit: 6, misses: 0 }), () => 120);
const heat = $<HTMLInputElement>('heat');
mountScene($<HTMLCanvasElement>('live'), () => ({ limit: 8, misses: Math.round((Number(heat.value) / 1000) * 8), melt: Number(heat.value) / 1000 }));

// stills that redraw when the layout or fonts change
const stills: (() => void)[] = [];
function still(host: HTMLElement, caption: string, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const fig = document.createElement('figure');
  const canvas = document.createElement('canvas');
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.append(canvas, cap);
  host.append(fig);
  stills.push(() => {
    const fit = fitCanvas(canvas);
    if (fit) paint(fit.ctx, fit.w, fit.h);
  });
}

const melvinSheet = $('melvin-sheet');
for (const [melt, caption] of [[0, 'Fresh'], [0.33, 'Warm'], [0.67, 'Worried'], [0.875, 'Nearly gone']] as const) {
  still(melvinSheet, caption, (ctx, w, h) => {
    ctx.fillStyle = C.sand;
    ctx.fillRect(0, h * 0.8, w, h);
    const s = Math.min((h * 0.72) / 285, (w * 0.86) / 300);
    ctx.translate(w / 2, h * 0.9);
    ctx.scale(s, s);
    drawMelvin(ctx, { melt, t: 0 });
  });
}
const raySheet = $('ray-sheet');
for (const [h01, caption] of [[0, 'Smug'], [0.5, 'Pleased'], [1, 'Gloating']] as const) {
  still(raySheet, caption, (ctx, w, h) => {
    const s = (Math.min(w, h) / 150) * (0.82 + 0.18 * h01);
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    drawRay(ctx, { heat: h01, t: 0 });
  });
}
const redraw = () => stills.forEach((f) => f());
new ResizeObserver(redraw).observe(document.body);
document.fonts.ready.then(redraw);

// the phone frame is a real 440 x 956 page, scaled to fit
const frame = $<HTMLIFrameElement>('frame');
const fitFrame = () => {
  const k = frame.parentElement!.clientWidth / 440;
  frame.style.transform = `scale(${k})`;
  frame.parentElement!.style.height = `${Math.round(956 * k) + 10}px`;
};
addEventListener('resize', fitFrame);
fitFrame();

const swatches: [string, string][] = [
  ['Ink', C.ink], ['Snow', C.snow], ['Snow shade', C.snowShade], ['Sky', C.sky], ['Sea', C.sea],
  ['Sand', C.sand], ['Sun', C.sun], ['Heat', C.skyHot], ['Coral', C.coral], ['Carrot', C.carrot],
  ['Hat', C.hat], ['Cream', C.cream],
];
$('swatches').innerHTML = swatches.map(([n, c]) => `<div class="swatch"><i style="background:${c}"></i><span>${n}</span></div>`).join('');
$('alphabet').innerHTML = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => `<span class="tile">${c}</span>`).join('');
