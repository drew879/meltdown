// Draws the melt over the play screen's scene: the beat on every wrong guess
// (the sun flares, heat rises, he slumps through the stages in between and
// sweats) and the loss (he melts out from under his hat, which hangs, drops
// into the puddle and floats there while the eyes blink). What happens when is
// in melt-timeline.ts; this draws one frame of it at a time.
//
// It works like the win celebration: while it plays, the plain snowman is
// faded out (not removed, so screen readers still get his description) and a
// copy of him takes his place, standing exactly where he stood. A wrong guess
// hands back to the plain snowman when the beat is over. A lost round stays
// here, as the puddle at rest.
import './melt.css';
import { art, manifest, snowmanPiece } from './art';
import type { SceneMetrics } from './celebration';
import {
  LOSS_MS,
  MELT_PIECES,
  REST,
  lossFrame,
  missFrame,
  missMs,
  restFrame,
  type HatPiece,
  type MeltFrame,
  type MeltPiece,
  type Particle,
} from './melt-timeline';

export interface Melt {
  layout(metrics: SceneMetrics): void;
  /** A wrong guess has just been made: play him from one stage down to the next. */
  playMiss(from: number, to: number): void;
  /** The last wrong guess: play the loss from the stage he was at. Settles once the puddle is at rest: played out, skipped or stopped. */
  playLoss(from: number): Promise<void>;
  /** A lost round is on screen without having just been lost (a refresh, or reduced motion): show the puddle at rest. */
  showRest(): void;
  /** A tap while the loss plays: jump to its end. Says whether there was anything to skip. */
  skip(): boolean;
  /** Nothing is melting: the plain snowman stands in the scene. */
  reset(): void;
  destroy(): void;
}

type Mode = 'idle' | 'miss' | 'loss' | 'rest';
/** The melt stages a beat can show: a round is lost from stage 6 or 7, so the drawn stage 8 is never needed here. */
const STAGES = [0, 1, 2, 3, 4, 5, 6, 7];
const HATS: HatPiece[] = ['hat-6', 'hat-7', 'puddle-hat'];

/** `piece` names the picture, for the browser checks. */
function img(src: string, piece: string, className = ''): HTMLImageElement {
  const el = new Image();
  el.alt = '';
  el.src = src;
  el.className = className;
  el.dataset.piece = piece;
  el.draggable = false;
  return el;
}

/**
 * `animateRest` is false under reduced motion (and ?still): the puddle at rest is then a still picture.
 */
export function createMelt(scene: HTMLElement, snowman: HTMLImageElement, sun: HTMLImageElement, animateRest: boolean): Melt {
  // ---- the pieces ----
  // each loose piece's address and its size in the cut art's pixels
  const pieces = Object.fromEntries(MELT_PIECES.map((name) => [name, { src: art(name), ...manifest[name] }])) as Record<MeltPiece, { src: string; w: number; h: number }>;
  // Every picture is a direct child of the actor and is moved by its own transform: WebKit does not
  // paint pictures nested in a second zero-size box inside the actor's drop shadow.
  const bodies = new Map<number | 'puddle', HTMLImageElement>();
  for (const stage of STAGES) bodies.set(stage, img(art(snowmanPiece(stage)), snowmanPiece(stage), 'pp-melt-body'));
  bodies.set('puddle', img(pieces.puddle.src, 'puddle', 'pp-melt-body'));
  for (const picture of bodies.values()) picture.hidden = true;
  const eyes = { open: img(pieces['puddle-eyes'].src, 'puddle-eyes'), closed: img(pieces['puddle-eyes-closed'].src, 'puddle-eyes-closed') };
  const carrot = img(pieces['puddle-carrot'].src, 'puddle-carrot');
  const hats = new Map(HATS.map((name) => [name, img(pieces[name].src, name, 'pp-melt-hat')] as const));
  const loose = [eyes.open, eyes.closed, carrot, ...hats.values()];
  for (const piece of loose) piece.hidden = true;
  const actor = document.createElement('div');
  actor.className = 'pp-melt-actor';
  actor.append(...bodies.values(), eyes.open, eyes.closed, carrot, ...hats.values());
  const behind = document.createElement('div');
  behind.className = 'pp-melt-bits';
  const front = document.createElement('div');
  front.className = 'pp-melt-bits';
  const box = document.createElement('div');
  box.className = 'pp-melt';
  box.hidden = true;
  box.setAttribute('aria-hidden', 'true');
  box.append(behind, actor, front);
  scene.append(box);
  // the flare goes in before the sun, so the sun covers its middle
  const flare = img(pieces['sun-flare'].src, 'sun-flare', 'pp-melt-flare');
  flare.hidden = true;
  scene.insertBefore(flare, sun);
  // heat and drops: a few of each, made as they are first needed
  const pools: Record<'behind' | 'front', HTMLImageElement[]> = { behind: [], front: [] };

  // ---- layout, from the play screen's numbers ----
  let m: SceneMetrics | null = null;
  function layout(metrics: SceneMetrics) {
    m = metrics;
    const k = m.k;
    actor.style.left = `${m.centerX}px`;
    actor.style.top = `${m.baseY}px`;
    for (const [stage, picture] of bodies) {
      const size = stage === 'puddle' ? pieces.puddle : manifest[snowmanPiece(stage)];
      const lift = stage === 'puddle' ? REST.puddle.bottom : 0;
      const across = stage === 'puddle' ? REST.puddle.x : 0;
      picture.style.width = `${size.w * k}px`;
      picture.style.height = `${size.h * k}px`;
      picture.style.left = `${(across - size.w / 2) * k}px`;
      picture.style.top = `${-(lift + size.h) * k}px`;
    }
    // a loose piece sits with its middle on the anchor and is moved from there
    const centre = (picture: HTMLImageElement, name: MeltPiece) => {
      picture.style.width = `${pieces[name].w * k}px`;
      picture.style.height = `${pieces[name].h * k}px`;
      picture.style.left = `${(-pieces[name].w * k) / 2}px`;
      picture.style.top = `${(-pieces[name].h * k) / 2}px`;
    };
    centre(eyes.open, 'puddle-eyes');
    centre(eyes.closed, 'puddle-eyes-closed');
    centre(carrot, 'puddle-carrot');
    for (const [name, hat] of hats) centre(hat, name);
    for (const picture of [eyes.open, eyes.closed]) picture.style.transform = `translate(${REST.eyes.x * k}px, ${-REST.eyes.y * k}px)`;
    drawn = '';
    if (last) draw(last);
  }

  // ---- one frame ----
  let last: MeltFrame | null = null;
  /** what is on screen, so a frame that changes nothing costs nothing (the puddle at rest mostly holds still) */
  let drawn = '';
  function draw(f: MeltFrame) {
    last = f;
    if (!m) return;
    const key = JSON.stringify(f);
    if (key === drawn) return placeFlare(f); // nothing new to draw, but the sun under the flare may have moved
    drawn = key;
    const k = m.k;

    for (const [stage, picture] of bodies) {
      picture.hidden = stage !== f.body;
      if (stage === f.body) picture.style.transform = `translateX(${f.dx * k}px) scale(${f.sx}, ${f.sy})`;
    }

    for (const [name, hat] of hats) {
      const on = f.hat?.piece === name;
      hat.hidden = !on;
      if (on) hat.style.transform = `translate(${f.hat!.x * k}px, ${-f.hat!.y * k}px) rotate(${f.hat!.rot}deg) scale(1, ${f.hat!.sy})`;
    }
    carrot.hidden = !f.carrot;
    if (f.carrot) carrot.style.transform = `translate(${f.carrot.x * k}px, ${-f.carrot.y * k}px) rotate(${f.carrot.rot}deg)`;
    eyes.open.hidden = f.eyes !== 'open';
    eyes.closed.hidden = f.eyes !== 'closed';

    // the sun swells, with the ring of rays behind it
    sun.style.scale = f.sunScale === 1 ? '' : String(f.sunScale);
    placeFlare(f);

    bits(pools.behind, behind, f.particles.filter((p) => p.behind), k);
    bits(pools.front, front, f.particles.filter((p) => !p.behind), k);
  }
  /**
   * The ring of rays sits centred behind the sun as the sun is right now. A miss also turns the heat
   * up, and the sun takes half a second to step to its new size and place (paper.css), so the place
   * the play screen laid out is where it is going, not where it is. Called every frame the flare shows.
   */
  function placeFlare(f: MeltFrame) {
    flare.hidden = !f.flare;
    if (!f.flare) return;
    // the sun's own box in the scene, before its pulse and swell, which both turn about its middle
    const size = sun.offsetWidth * f.sunScale * f.flare.scale;
    const x = sun.offsetLeft + sun.offsetWidth / 2;
    const y = sun.offsetTop + sun.offsetHeight / 2;
    flare.style.width = `${size}px`;
    flare.style.height = `${size}px`;
    flare.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${f.flare.rot}deg)`;
  }
  function bits(pool: HTMLImageElement[], layer: HTMLElement, list: Particle[], k: number) {
    while (pool.length < list.length) {
      const bit = img('', '');
      pool.push(bit);
      layer.append(bit);
    }
    pool.forEach((bit, i) => {
      const p = list[i];
      bit.hidden = !p;
      if (!p || !m) return;
      const piece = pieces[p.piece];
      if (bit.dataset.piece !== p.piece) {
        bit.dataset.piece = p.piece;
        bit.src = piece.src;
      }
      const h = p.size * k;
      const w = (h * piece.w) / piece.h;
      bit.style.width = `${w}px`;
      bit.style.height = `${h}px`;
      bit.style.opacity = String(p.opacity);
      bit.style.transform = `translate(${m.centerX + p.x * k - w / 2}px, ${m.baseY - p.y * k - h / 2}px) rotate(${p.rot}deg)`;
    });
  }

  // ---- the clock ----
  let mode: Mode = 'idle';
  let raf = 0;
  let t0 = 0;
  let beat = { from: 0, to: 0 };
  let whenAtRest: (() => void) | null = null;

  // Nothing plays before its pictures are in: a beat asked for sooner is simply not shown.
  // The heat and the drops are drawn by the pools, which only set their addresses when a beat
  // needs them, so they are fetched here too; otherwise the first beat on a slow phone has none.
  const bitPictures = (['heat-1', 'heat-2', 'drop'] as const).map((name) => img(pieces[name].src, name));
  let ready = false;
  let wantRest = false;
  void Promise.all([...bodies.values(), ...loose, flare, ...bitPictures].map((picture) => picture.decode().catch(() => undefined))).then(() => {
    ready = true;
    if (wantRest && mode === 'idle') rest(performance.now());
  });

  function show(active: boolean) {
    box.hidden = !active;
    snowman.classList.toggle('aside', active);
    if (!active) {
      sun.style.scale = '';
      flare.hidden = true;
      last = null;
      drawn = '';
    }
  }
  function settle() {
    const done = whenAtRest;
    whenAtRest = null;
    done?.();
  }
  function stop() {
    cancelAnimationFrame(raf);
    wantRest = false;
    mode = 'idle';
    show(false);
    settle();
  }
  /** The puddle at rest, from `since` on. */
  function rest(since: number) {
    cancelAnimationFrame(raf);
    mode = 'rest';
    t0 = since;
    show(true);
    draw(restFrame(animateRest ? Math.max(0, performance.now() - since) : null));
    settle();
    if (animateRest) raf = requestAnimationFrame(frame);
  }
  function frame() {
    const t = performance.now() - t0; // the same clock t0 was read from
    if (mode === 'miss') {
      if (t >= missMs(beat.from, beat.to)) return stop();
      draw(missFrame(beat.from, beat.to, t));
    } else if (mode === 'loss') {
      if (t >= LOSS_MS) return rest(t0 + LOSS_MS);
      draw(lossFrame(beat.from, t));
    } else if (mode === 'rest') draw(restFrame(t));
    else return;
    raf = requestAnimationFrame(frame);
  }
  function begin(next: 'miss' | 'loss', from: number, to: number) {
    cancelAnimationFrame(raf);
    settle();
    mode = next;
    beat = { from, to };
    t0 = performance.now();
    show(true);
    draw(next === 'miss' ? missFrame(from, to, 0) : lossFrame(from, 0));
    raf = requestAnimationFrame(frame);
  }

  return {
    layout,
    playMiss(from, to) {
      if (!ready || from === to) return stop();
      begin('miss', from, to);
    },
    playLoss(from) {
      if (!ready) {
        stop();
        wantRest = true;
        return Promise.resolve();
      }
      begin('loss', from, 8);
      return new Promise((resolve) => (whenAtRest = resolve));
    },
    showRest() {
      if (mode === 'rest' || mode === 'loss') return; // already there, or on its way
      if (!ready) {
        wantRest = true;
        return;
      }
      rest(performance.now());
    },
    skip() {
      if (mode !== 'loss') return false;
      rest(performance.now());
      return true;
    },
    reset: stop,
    destroy() {
      stop();
      box.remove();
      flare.remove();
    },
  };
}
