import { C } from './palette';
import { ellipse, ink, stroke, type Ctx } from './draw';

/**
 * The danger meter: a chunky thermometer with one notch per allowed miss.
 * The red climbs a notch with every miss, and the bulb shows how many
 * misses are left. (x, top) to (x, bottom) is its centre line.
 */
export function drawThermo(
  ctx: Ctx,
  x: number,
  top: number,
  bottom: number,
  limit: number,
  misses: number,
  fontFamily: string,
): void {
  const H = bottom - top;
  const s = H / 190;
  const bulbR = 21 * s;
  const tubeW = 22 * s;
  const bulbY = bottom - bulbR;
  const tubeTop = top + tubeW / 2;
  const tubeBottom = bulbY - bulbR * 0.55;
  const lw = 4.5 * s;

  // glass
  const glass = new Path2D();
  glass.roundRect(x - tubeW / 2, top, tubeW, bulbY - top, tubeW / 2);
  glass.addPath(ellipse(x, bulbY, bulbR, bulbR));
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw * 2;
  ctx.stroke(glass);
  ctx.fillStyle = C.cream;
  ctx.fill(glass);

  // the red
  const left = Math.max(0, limit - misses);
  const frac = Math.min(1, misses / limit);
  const liquidTop = tubeBottom - (tubeBottom - tubeTop) * frac;
  ctx.fillStyle = C.coral;
  ctx.fill(ellipse(x, bulbY, bulbR - lw * 0.9, bulbR - lw * 0.9));
  const inner = tubeW - lw * 1.8;
  const col = new Path2D();
  col.roundRect(x - inner / 2, liquidTop - inner / 2, inner, bulbY - liquidTop + inner / 2, inner / 2);
  ctx.fill(col);
  ctx.fillStyle = C.coralDeep;
  ctx.fill(ellipse(x - bulbR * 0.28, bulbY + bulbR * 0.3, bulbR * 0.5, bulbR * 0.38, 0.6));
  ctx.fillStyle = C.coral;
  ctx.fill(ellipse(x - bulbR * 0.12, bulbY + bulbR * 0.12, bulbR * 0.52, bulbR * 0.42, 0.6));

  // one notch per miss allowed
  for (let i = 1; i <= limit; i++) {
    const ny = tubeBottom - ((tubeBottom - tubeTop) * i) / limit;
    const tick = new Path2D();
    tick.moveTo(x + tubeW / 2 + lw * 0.2, ny);
    tick.lineTo(x + tubeW / 2 + 11 * s, ny);
    stroke(ctx, tick, i <= misses ? 5 * s : 3.5 * s, i <= misses ? C.coralDeep : C.ink);
  }

  // shine
  const shine = new Path2D();
  shine.moveTo(x - inner * 0.22, top + tubeW * 0.7);
  shine.lineTo(x - inner * 0.22, top + H * 0.28);
  stroke(ctx, shine, 3 * s, 'rgba(255,255,255,0.85)');

  // misses left, in the bulb
  ctx.font = `${Math.round(25 * s)}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5 * s;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(String(left), x, bulbY + 1.5 * s);
  ctx.fillStyle = C.snow;
  ctx.fillText(String(left), x, bulbY + 1.5 * s);

  // a small flame at the top marks the danger end
  const fy = top - 13 * s;
  const flame = new Path2D();
  flame.moveTo(x, fy - 11 * s);
  flame.bezierCurveTo(x + 9 * s, fy - 2 * s, x + 9 * s, fy + 9 * s, x, fy + 9 * s);
  flame.bezierCurveTo(x - 9 * s, fy + 9 * s, x - 8 * s, fy + 1 * s, x - 3 * s, fy - 3 * s);
  flame.bezierCurveTo(x - 2 * s, fy - 6 * s, x - 1 * s, fy - 8 * s, x, fy - 11 * s);
  flame.closePath();
  ink(ctx, flame, C.ray, 3.5 * s);
}
