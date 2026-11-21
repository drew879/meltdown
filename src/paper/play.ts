// The play screen in the cut-paper look. It draws whatever round the engine
// holds: the sign, the keys, the thermometer, the snowman and the sun. It makes
// no rules of its own; a tap is handed back to the app as a letter.
import {
  categoryLabel,
  correctLetters,
  currentMatchStatus,
  missLimit,
  roundCells,
  roundMeltStage,
  roundMisses,
  roundOutcome,
  wrongLetters,
  type GameState,
  type GuessStatus,
  type Round,
} from '../engine';
import { el } from '../app/dom';
import { lossHeading, roundSeed, WIN_HEADING } from '../app/copy';
import { renderHeader } from '../app/header';
import { art, manifest, snowmanPiece, type Piece } from './art';
import { createCelebration } from './celebration';
import { createMelt } from './melt';
import { fitAnswer } from './sign-fit';
import { placeYard } from './yard';

export interface PlayDeps {
  yard: HTMLImageElement;
  reduceMotion: boolean;
  onGuess(letter: string): void;
  onNext(): void;
  onNewGame(event?: Event): void;
}

/** What just happened, when the screen is updating because of a tap and not because it was rebuilt. */
export interface PlayEvent {
  status: GuessStatus;
  letter: string;
}

export interface PlayScreen {
  root: HTMLElement;
  update(state: GameState, event?: PlayEvent): void;
  /** Lay everything out again, after the screen resized or the fonts arrived. */
  layout(): void;
  destroy(): void;
}

const STAGE_WORDS = [
  'fresh and proud',
  'a little worried',
  'starting to slump',
  'slumping',
  'getting shorter',
  'half melted',
  'mostly melted',
  'nearly gone',
  'a puddle',
];

type Mood = 'smug' | 'gleeful' | 'annoyed' | 'dismayed';

/** How long the keys stay on screen after the last guess, so the final move is seen. (A loss waits for its melt instead.) */
const RESULT_DELAY_MS = 1000;

// the post, and the flowers, snow and grass at the foot of the sign
const BITS: [Piece, string][] = [
  ['post', 'post'],
  ['snow-1', 'sl'],
  ['snow-2', 'sr'],
  ['grass-2', 'gl'],
  ['grass-4', 'gr'],
  ['crocus-yellow-2', 'fl2'],
  ['crocus-purple-2', 'fr2'],
  ['crocus-purple-1', 'fl'],
  ['crocus-yellow-1', 'fr'],
];

export function createPlayScreen(deps: PlayDeps): PlayScreen {
  const { yard, reduceMotion } = deps;

  // ---- the pieces ----
  const header = el('header', { class: 'pp-tags' });
  const sun = el('img', { class: 'pp-sun', alt: '' });
  const mercury = el('div', { class: 'pp-mercury' });
  const thermo = el('div', { class: 'pp-thermo', 'aria-hidden': 'true' }, mercury);
  const snowman = el('img', { class: 'pp-snowman', id: 'snowman', alt: '' });
  const scene = el('section', { class: 'pp-scene', id: 'scene' }, sun, thermo, snowman);
  const celebration = createCelebration(scene, snowman);
  const melt = createMelt(scene, snowman, sun, !reduceMotion);
  const answerEl = el('div', { class: 'pp-answer', id: 'answer', role: 'img' });
  const board = el('div', { class: 'pp-board', id: 'board' }, answerEl);
  const category = el('div', { class: 'pp-category', id: 'category' });
  const signbox = el('div', { class: 'pp-signbox', id: 'signbox' }, board, category);
  const sign = el('section', { class: 'pp-sign', id: 'sign', 'aria-label': 'The answer' }, signbox);
  const tray = el('div', { class: 'pp-tray', id: 'tray', 'aria-label': 'Letters' });
  const headline = el('h2', { class: 'pp-headline', tabindex: -1 });
  const note = el('p', { class: 'pp-note' });
  const nextButton = el('button', { class: 'pp-btn', id: 'next', type: 'button', onclick: () => deps.onNext() });
  const result = el('div', { class: 'pp-result', id: 'result', hidden: true }, headline, note, nextButton);
  const lower = el('div', { class: 'pp-lower' }, tray, result);
  const live = el('div', { class: 'pp-sr', 'aria-live': 'polite' });
  const root = el('div', { class: 'pp-screen play' }, header, scene, sign, lower, live);

  for (const [piece, place] of BITS) {
    signbox.append(el('img', { src: art(piece), alt: '', class: `pp-bit ${place}` }));
  }

  // ---- the keyboard ----
  const keys = new Map<string, HTMLButtonElement>();
  for (const row of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
    const rowEl = el('div', { class: 'pp-krow' });
    for (const ch of row) {
      const key = el('button', { class: 'pp-key', type: 'button', onclick: () => deps.onGuess(ch) }, ch);
      keys.set(ch, key);
      rowEl.append(key);
    }
    tray.append(rowEl);
  }
  const onKeydown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !/^[a-zA-Z]$/.test(e.key)) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (phase === 'play') deps.onGuess(e.key.toUpperCase());
  };
  addEventListener('keydown', onKeydown);
  // The melt at the end of a lost round can be skipped with a tap anywhere but the name tags, or with
  // Enter, Space or Escape. It listens for the press, not the click, so the tap on the last wrong key
  // (whose click is what starts the melt) can never skip it.
  const onSkipPress = (e: PointerEvent) => {
    if (!header.contains(e.target as Node)) melt.skip();
  };
  const onSkipKey = (e: KeyboardEvent) => {
    // a key on the New game button, or on the confirmation or a notice over the screen, is for that button
    const target = e.target as Node;
    if (e.repeat || header.contains(target) || (target !== document.body && !root.contains(target))) return;
    if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && melt.skip()) e.preventDefault();
  };
  root.addEventListener('pointerdown', onSkipPress);
  addEventListener('keydown', onSkipKey);

  // ---- what is on screen ----
  let phase: GameState['phase'] = 'play';
  let round: Round | null = null;
  let answer = '';
  let shownStage = -1;
  let notchesFor = 0;
  let moodTimer = 0;
  let resultTimer = 0;
  /** Bumped whenever the result's reveal is planned afresh, so an older wait (for a melt that has since been replaced) does nothing. */
  let resultRun = 0;
  /**
   * True while the melt of a lost round plays: the sign keeps showing the round as it was before the
   * last miss, and the answer with its missed letters comes up with the heading when the melt ends
   * (Drew, 2026-11-21).
   */
  let holdAnswer = false;
  let popLetter: string | undefined;
  let destroyed = false;

  const outcome = () => (round ? roundOutcome(round) : 'playing');
  const stage = () => (!round || outcome() === 'won' ? 0 : roundMeltStage(round));

  function setSun(mood: Mood, forMs = 0) {
    clearTimeout(moodTimer);
    sun.src = art(`sun-${mood}` as Piece);
    if (forMs) moodTimer = window.setTimeout(() => setSun(restingMood()), forMs);
  }
  const restingMood = (): Mood => (outcome() === 'won' ? 'dismayed' : outcome() === 'lost' ? 'gleeful' : 'smug');

  // ---- the thermometer: one notch per miss allowed ----
  function drawNotches(limit: number) {
    if (limit === notchesFor) return;
    notchesFor = limit;
    thermo.querySelectorAll('.pp-notch').forEach((n) => n.remove());
    for (let i = 1; i <= limit; i++) {
      const n = el('i', { class: 'pp-notch' });
      n.style.top = `${(1 - i / limit) * 100 + 0.5}%`;
      thermo.append(n);
    }
  }

  // ---- the answer on its garden sign ----
  function drawAnswer() {
    if (!round) return;
    const fit = fitAnswer(answer, Math.min(600, sign.clientWidth - 40), innerHeight);
    const { slot, rows } = fit;
    board.style.width = `${fit.width}px`;
    board.style.height = `${fit.height}px`;
    board.style.borderWidth = `0 ${fit.end}px`;
    board.style.borderImageSource = `url(${art(fit.sign.piece)})`;
    board.style.borderImageSlice = `0 ${fit.sign.end * 100}% fill`;
    board.style.borderImageWidth = `0 ${fit.end}px`;
    // the category tag overlaps the board's top edge, but never further than the plain wood above the first row
    const textHeight = slot * (1.3 * rows.length + 0.3 * (rows.length - 1));
    signbox.style.setProperty('--overlap', `${Math.max(2, Math.min(17, (fit.height - textHeight) / 2 - 5))}px`);
    signbox.style.setProperty('--flower', `${Math.max(46, Math.min(72, 30 + fit.height * 0.42))}px`);
    answerEl.style.setProperty('--slot', `${slot}px`);
    answerEl.replaceChildren();
    const cells = roundCells(round, outcome() === 'lost' && !holdAnswer);
    let index = 0;
    for (const row of rows) {
      const rowEl = el('div', { class: 'pp-row' });
      for (const word of row) {
        const wordEl = el('div', { class: 'pp-word' });
        for (const ch of Array.from(word)) {
          const cell = cells[index++]!;
          const slotEl = el('span', { class: 'pp-slot' });
          if (cell.letter === null) slotEl.textContent = ch; // numbers and punctuation are simply shown
          else {
            slotEl.classList.add('letter');
            if (cell.revealed) slotEl.textContent = ch.toUpperCase();
            if (cell.missed) slotEl.classList.add('missed');
            if (cell.letter === popLetter && cell.revealed && !reduceMotion) slotEl.classList.add('pop');
          }
          wordEl.append(slotEl);
        }
        index++; // the space after the word
        rowEl.append(wordEl);
      }
      answerEl.append(rowEl);
    }
    const shown = cells
      .map((c) => (c.letter === null ? c.char : c.missed ? `${c.char} (missed)` : c.revealed ? c.char : 'blank'))
      .join(' ');
    answerEl.setAttribute('aria-label', `${categoryLabel(round.puzzle.category)}: ${shown}`);
  }

  // ---- the scene ----
  function layoutScene() {
    if (!round) return;
    const W = innerWidth;
    const box = scene.getBoundingClientRect();
    const heat = Math.min(1, roundMisses(round) / missLimit(round));

    // the snowman: every stage shares one scale, set by how tall the fresh one should stand
    const full = Math.min(box.height * 0.82, box.width * 0.8);
    const k = full / manifest['snowman-0'].h;
    const piece = manifest[snowmanPiece(shownStage < 0 ? stage() : shownStage)];
    const baseY = box.height * 0.985;
    snowman.style.width = `${piece.w * k}px`;
    snowman.style.height = `${piece.h * k}px`;
    snowman.style.left = `${box.width * 0.48 - (piece.w * k) / 2}px`;
    snowman.style.top = `${baseY - piece.h * k}px`;

    // the sun grows and leans in as the heat rises
    const sunSize = Math.min(box.width * 0.3, box.height * 0.42) * (1 + 0.38 * heat);
    const sunLeft = box.width * (0.03 + 0.04 * heat);
    const sunTop = box.height * (0.05 + 0.05 * heat);
    sun.style.width = `${sunSize}px`;
    sun.style.left = `${sunLeft}px`;
    sun.style.top = `${sunTop}px`;

    // the win celebration and the melt stand in the same place and at the same scale
    const metrics = {
      width: box.width,
      height: box.height,
      full,
      k,
      baseY,
      centerX: box.width * 0.48,
      sunX: sunLeft + sunSize / 2,
      sunY: sunTop + sunSize / 2,
      sunSize,
    };
    celebration.layout(metrics);
    melt.layout(metrics);

    // the thermometer
    const tw = Math.max(20, Math.min(30, box.height * 0.08));
    const th = Math.min(box.height * 0.5, 200);
    thermo.style.setProperty('--w', `${tw}px`);
    thermo.style.height = `${th}px`;
    thermo.style.right = `${Math.max(14, box.width * 0.06)}px`;
    thermo.style.top = `${box.height * 0.05 + 14}px`; // clear of the role label under the name tag
    mercury.style.height = `${th * heat + tw * 0.6}px`;

    // the yard: slide the painting so its grass line sits behind the snowman's middle
    void W;
    placeYard(yard, box.top + baseY - full * 0.4);
  }

  function layout() {
    drawAnswer();
    layoutScene();
    layoutScene(); // the sign's height feeds the scene's height, so lay out once more
  }

  /** Shows the stage, and returns a promise that settles once the snowman has finished moving (at once if he did not move). */
  function showStage(next: number, animate: boolean): Promise<void> {
    const apply = () => {
      if (destroyed) return;
      shownStage = next;
      snowman.src = art(snowmanPiece(next));
      layoutScene();
    };
    if (!animate || reduceMotion || shownStage === next) {
      apply();
      return Promise.resolve();
    }
    // a stop-motion pop: squash, swap the piece, spring back
    return snowman
      .animate([{ transform: 'scale(1.07, 0.9)' }, { transform: 'scale(1.1, 0.86)' }], {
        duration: 170,
        easing: 'steps(2, jump-none)',
      })
      .finished.then(() => {
        apply();
        return snowman.animate(
          [{ transform: 'scale(0.93, 1.09)' }, { transform: 'scale(1.04, 0.96)' }, { transform: 'scale(1, 1)' }],
          { duration: 300, easing: 'steps(3, jump-none)' },
        ).finished;
      })
      .then(
        () => undefined,
        () => undefined, // an animation that was cancelled (the screen was torn down) is simply over
      );
  }

  function describe() {
    if (!round) return;
    const left = missLimit(round) - roundMisses(round);
    const words = STAGE_WORDS[stage()]!;
    const tail =
      outcome() === 'playing' ? ` ${left} ${left === 1 ? 'miss' : 'misses'} left.` : outcome() === 'won' ? ' Saved!' : '';
    snowman.alt = `The snowman is ${words}.${tail}`;
  }

  function markKeys() {
    if (!round) return;
    const right = new Set(correctLetters(round));
    const wrong = new Set(wrongLetters(round));
    for (const [ch, key] of keys) {
      const hit = right.has(ch);
      const miss = wrong.has(ch);
      key.classList.toggle('hit', hit);
      key.classList.toggle('miss', miss);
      key.disabled = miss || phase !== 'play';
      if (hit || miss) key.setAttribute('aria-label', `${ch}, ${hit ? 'correct' : 'wrong'}`);
      else key.removeAttribute('aria-label');
    }
  }

  /** `after`, when given, is the melt that must play out (or be skipped) before the result comes up. */
  function showResult(state: GameState, live: boolean, after?: Promise<void>) {
    const solved = outcome() === 'won';
    const guesser = state.players[round!.guesser]!.name;
    headline.textContent = solved ? WIN_HEADING : lossHeading(roundSeed(answer, state.history.length));
    note.textContent = solved ? `${guesser} scores a point.` : 'No point this time.';
    const over = currentMatchStatus(state).over;
    nextButton.textContent = over ? 'See who won' : 'Next round';
    const reveal = () => {
      // the panel takes the keys' place in the same cell, so nothing moves when they go away
      tray.classList.add('away');
      tray.inert = true;
      result.hidden = false;
      if (live) headline.focus({ preventScroll: true }); // screen readers read the result out
    };
    clearTimeout(resultTimer);
    const run = ++resultRun;
    if (after) {
      void after.then(() => {
        if (destroyed || run !== resultRun) return;
        // the melt is over (played out or skipped): the answer comes up on the sign with the heading
        holdAnswer = false;
        drawAnswer();
        reveal();
      });
    }
    else if (live && !reduceMotion) resultTimer = window.setTimeout(reveal, RESULT_DELAY_MS);
    else reveal();
  }

  /** A line for screen readers after each guess. */
  function announce(event: PlayEvent) {
    if (!round) return;
    const left = missLimit(round) - roundMisses(round);
    const base = event.status === 'correct' ? `${event.letter} is in the answer.` : `No ${event.letter}.`;
    const tail =
      outcome() === 'playing' ? (event.status === 'wrong' ? ` ${left} ${left === 1 ? 'miss' : 'misses'} left.` : '') : outcome() === 'won' ? ' You got it!' : ' The snowman melted.';
    live.textContent = base + tail;
  }

  return {
    root,
    layout,
    update(state, event) {
      phase = state.phase;
      round = state.round;
      if (!round) return;
      const stageBefore = shownStage; // what he looked like before this guess
      answer = round.puzzle.answer;
      popLetter = event?.status === 'correct' ? event.letter : undefined;
      renderHeader(header, state, deps.onNewGame);
      const label = categoryLabel(round.puzzle.category);
      category.textContent = label;
      category.classList.toggle('long', Array.from(label).length > 24);
      drawNotches(missLimit(round));
      markKeys();
      // A wrong guess that has just been made melts him, unless motion is reduced.
      const melting = !!event && event.status === 'wrong' && !reduceMotion && stageBefore >= 0;
      holdAnswer = melting && outcome() === 'lost';
      drawAnswer();
      popLetter = undefined; // the pop plays once, not again on every resize

      if (event) {
        const status = event.status;
        if (outcome() === 'won') setSun('dismayed');
        else if (outcome() === 'lost') setSun('gleeful');
        else if (status === 'correct') setSun('annoyed', 1100);
        else if (status === 'wrong') setSun('gleeful', 1500);
        if (status === 'correct' && outcome() === 'playing' && !reduceMotion) {
          snowman.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-5%)' }, { transform: 'translateY(0)' }], {
            duration: 260,
            easing: 'steps(3, jump-none)',
          });
        }
        announce(event);
      } else {
        setSun(restingMood());
      }
      // A wrong guess melts him: a beat down to the next stage, or on the last one the melt into the
      // puddle. The plain snowman takes the new stage at once, behind the melt, so whatever interrupts
      // the beat (another guess, a resize, the screen going away) finds him where he should be.
      let lossPlayed: Promise<void> | undefined;
      let settled = Promise.resolve();
      if (outcome() === 'lost') {
        void showStage(stage(), false);
        if (melting) lossPlayed = melt.playLoss(stageBefore);
        else melt.showRest();
      } else if (melting && outcome() === 'playing') {
        void showStage(stage(), false);
        melt.playMiss(stageBefore, stage());
      } else {
        melt.reset();
        settled = showStage(stage(), !!event);
      }
      describe();
      layoutScene();

      // a win is celebrated: the backflip, the cloud and the snow. It waits until the snowman has
      // sprung back to full size. A won round that is simply on screen (a refresh, or reduced
      // motion) shows how the celebration ends instead.
      if (outcome() === 'won') {
        if (event && !reduceMotion) {
          void settled.then(() => {
            if (!destroyed && outcome() === 'won') celebration.play();
          });
        } else celebration.showRest();
      } else celebration.reset();

      if (phase === 'result') showResult(state, !!event, lossPlayed);
      else {
        tray.classList.remove('away');
        tray.inert = false;
        result.hidden = true;
      }
    },
    destroy() {
      destroyed = true;
      removeEventListener('keydown', onKeydown);
      removeEventListener('keydown', onSkipKey);
      clearTimeout(moodTimer);
      clearTimeout(resultTimer);
      celebration.destroy();
      melt.destroy();
    },
  };

}
