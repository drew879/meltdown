import { drawBeach, drawSuitcase, drawUmbrella } from './beach';
import { clamp01, lerp, type Ctx } from './draw';
import { drawMelvin } from './melvin';
import { drawRay } from './ray';
import { drawThermo } from './thermo';

export const DISPLAY_FONT = "'Bagel Fat One', system-ui, sans-serif";

export interface SceneState {
  /** Misses allowed this round (4, 6 or 8). */
  limit: number;
  /** Misses so far. */
  misses: number;
  /** Optional override of the melt (0 to 1), for scrubbing by hand. */
  melt?: number;
}

export interface SceneLayout {
  /** One design unit in pixels. */
  u: number;
  melvin: { x: number; ground: number; scale: number };
  ray: { x: number; y: number; scale: number };
  thermo: { x: number; top: number; bottom: number };
}

/**
 * Where everything sits for a stage of `w` by `h` pixels. `top` is the
 * height of whatever overlays the top of the stage (status bar, scoreboard),
 * so the sun and thermometer stay clear of it.
 */
export function layoutScene(w: number, h: number, top: number, melt: number): SceneLayout {
  const u = Math.min(w, h) / 400;
  const open = h - top;
  const ground = h * 0.9;
  const scale = Math.min((open * 0.6) / 270, (w * 0.6) / 210);
  const rayScale = lerp(0.85, 1.55, melt) * Math.min(u, open / 330);
  const thermoTop = top + 34 * u;
  return {
    u,
    melvin: { x: w * 0.47, ground, scale },
    ray: {
      x: w - lerp(66, 104, melt) * u,
      y: top + lerp(62, 104, melt) * Math.min(u, open / 330),
      scale: rayScale,
    },
    thermo: { x: 34 * u, top: thermoTop, bottom: thermoTop + Math.min(190 * u, open * 0.42) },
  };
}

export function drawScene(ctx: Ctx, w: number, h: number, s: SceneState, t: number, top = 0): void {
  const melt = clamp01(s.melt ?? s.misses / s.limit);
  const L = layoutScene(w, h, top, melt);
  const { u } = L;

  drawBeach(ctx, w, h, melt, t, { x: L.ray.x, y: L.ray.y, r: 40 * L.ray.scale });

  ctx.save();
  ctx.translate(L.ray.x, L.ray.y);
  ctx.scale(L.ray.scale, L.ray.scale);
  drawRay(ctx, { heat: melt, t });
  ctx.restore();

  drawUmbrella(ctx, w - 30 * u, h * 0.81, Math.min(170 * u, h * 0.4), t);
  drawSuitcase(ctx, w * 0.8, h * 0.84, 46 * u);

  ctx.save();
  ctx.translate(L.melvin.x, L.melvin.ground);
  ctx.scale(L.melvin.scale, L.melvin.scale);
  drawMelvin(ctx, { melt, t });
  ctx.restore();

  drawThermo(ctx, L.thermo.x, L.thermo.top, L.thermo.bottom, s.limit, s.misses, DISPLAY_FONT);
}

/** Size a canvas for the screen's pixel density and return a context scaled to CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: Ctx; w: number; h: number } | null {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return null;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/**
 * Keep a canvas painted with the live scene. Returns a function that stops it.
 * With "reduce motion" switched on, the scene holds still.
 */
export function mountScene(canvas: HTMLCanvasElement, get: () => SceneState, top: () => number = () => 0): () => void {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('still');
  const t0 = performance.now();
  let raf = 0;
  const paint = (now: number) => {
    const fit = fitCanvas(canvas);
    if (fit) drawScene(fit.ctx, fit.w, fit.h, get(), still ? 0 : (now - t0) / 1000, top());
  };
  const frame = (now: number) => {
    paint(now);
    raf = requestAnimationFrame(frame);
  };
  // Paint straight away and whenever the size changes, so there is a picture
  // even where animation frames are held back (a hidden tab, an off-screen frame).
  const ro = new ResizeObserver(() => paint(performance.now()));
  ro.observe(canvas);
  document.fonts.ready.then(() => paint(performance.now()));
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}
