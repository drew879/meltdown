// The app: one page that shows the screen for the engine's current phase.
// Every tap goes through `reduce`, and the new state is saved straight away.
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  DIFFICULTIES,
  MISS_LIMITS,
  createInitialState,
  createSaveStore,
  getBrowserStorage,
  reduce,
  type Action,
  type Difficulty,
  type GameState,
  type LoadStatus,
  type Reduction,
  type SaveStore,
} from '../engine';
import { createPlayScreen, type PlayEvent, type PlayScreen } from '../paper/play';
import { preloadArt } from '../paper/art';
import { createYard } from '../paper/yard';
import { el } from './dom';
import {
  emptyDraft,
  handoffScreen,
  matchOverScreen,
  namesScreen,
  setupScreen,
  type Screen,
  type ScreenContext,
  type SetupDraft,
} from './screens';

const STORAGE_NOTICE = 'This phone is not saving the game. You can keep playing, but closing the page will start over.';
const DROPPED_SAVE_NOTICE = 'The saved game could not be opened, so this is a new game.';

/**
 * A game for screenshots and quick checks: `?a=Polar Bear&c=Animal&limit=6&g=ARE`.
 * It is built with the real engine, is never saved and never reads a save.
 */
function demoState(params: URLSearchParams): GameState | null {
  const answer = params.get('a');
  if (answer === null) return null;
  const wanted = (params.get('c') ?? 'Place').trim();
  const known = CATEGORY_IDS.find((id) => id !== 'other' && CATEGORY_LABELS[id].toLowerCase() === wanted.toLowerCase());
  const limit = Number(params.get('limit'));
  const difficulty = DIFFICULTIES.find((d) => MISS_LIMITS[d] === limit) ?? 'normal';
  const steps: Action[] = [
    { type: 'start', names: ['Dad', 'Sam'], matchLength: 'endless' },
    {
      type: 'submitPuzzle',
      puzzle: { answer, category: known ? { id: known } : { id: 'other', custom: wanted } },
      difficulty,
    },
    { type: 'confirmHandoff' },
    ...[...(params.get('g') ?? '').toUpperCase()].filter((c) => /[A-Z]/.test(c)).map((letter): Action => ({ type: 'guess', letter })),
  ];
  let state = createInitialState();
  for (const step of steps) {
    const next = reduce(state, step);
    if (next.error) return step.type === 'guess' ? state : null; // a bad letter or a finished round just stops there
    state = next.state;
  }
  return state;
}

export function startApp(host: HTMLElement) {
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('still');

  const yard = createYard();
  const screenHost = el('div', { class: 'pp-screens' });
  // a live region that exists from the start, so screen readers announce what is added to it
  const notices = el('div', { class: 'pp-notices', role: 'status', 'aria-live': 'polite' });
  host.replaceChildren(yard, screenHost, notices);
  preloadArt();
  // pages leave room under the name tags for a notice, so it never covers their words
  new ResizeObserver(() => host.style.setProperty('--notice-h', `${notices.offsetHeight}px`)).observe(notices);

  function notify(text: string) {
    if ([...notices.children].some((n) => n.textContent?.startsWith(text))) return;
    const note = el(
      'div',
      { class: 'pp-notice' },
      text,
      el('button', { type: 'button', class: 'pp-notice-ok', onclick: () => note.remove() }, 'OK'),
    );
    notices.append(note);
  }

  // ---- the game's state, loaded and saved ----
  const demo = demoState(params);
  const store: SaveStore | null = demo ? null : createSaveStore(getBrowserStorage(), { onFallback: () => notify(STORAGE_NOTICE) });
  let state: GameState;
  if (demo) state = demo;
  else {
    const loaded = store!.load();
    state = loaded.state;
    const dropped: LoadStatus[] = ['corrupt', 'incompatible'];
    if (dropped.includes(loaded.status)) notify(DROPPED_SAVE_NOTICE);
  }

  let draft: SetupDraft = emptyDraft();
  let play: PlayScreen | null = null;
  let relayout: () => void = () => {};
  let shownPhase: GameState['phase'] | null = null;
  let dialogOpen = false;

  function dispatch(action: Action): Reduction {
    const result = reduce(state, action);
    if (result.error) return result;
    if (action.type === 'guess' && result.guess === 'repeat') return result; // nothing changed
    state = result.state;
    store?.save(state);
    if (['start', 'continue', 'rematch', 'newSession'].includes(action.type)) draft = emptyDraft();
    const event: PlayEvent | undefined =
      action.type === 'guess' && result.guess ? { status: result.guess, letter: action.letter.toUpperCase() } : undefined;
    render(event);
    return result;
  }

  function context(): ScreenContext {
    return {
      state,
      yard,
      draft,
      dispatch,
      askNewGame,
      changeAnswer() {
        const round = state.round;
        if (round) {
          const { category } = round.puzzle;
          draft = {
            answer: round.puzzle.answer,
            category: category.id,
            custom: category.custom ?? '',
            difficulty: round.difficulty as Difficulty,
            hidden: true, // the guesser may be holding the phone: come back with the answer hidden
          };
        }
        dispatch({ type: 'backToSetup' });
      },
    };
  }

  function render(event?: PlayEvent) {
    const wantsPlay = state.phase === 'play' || state.phase === 'result';
    if (wantsPlay) {
      if (!play) {
        play = createPlayScreen({
          yard,
          reduceMotion,
          onGuess: (letter) => {
            if (!dialogOpen && state.phase === 'play') dispatch({ type: 'guess', letter });
          },
          onNext: () => dispatch({ type: 'continue' }),
          onNewGame: askNewGame,
        });
        screenHost.replaceChildren(play.root);
      }
      play.update(state, event);
      play.layout();
      relayout = () => play?.layout();
    } else {
      play?.destroy();
      play = null;
      const ctx = context();
      const next: Screen =
        state.phase === 'names'
          ? namesScreen(ctx)
          : state.phase === 'setup'
            ? setupScreen(ctx)
            : state.phase === 'handoff'
              ? handoffScreen(ctx)
              : matchOverScreen(ctx);
      screenHost.replaceChildren(next.root);
      next.layout();
      relayout = () => next.layout();
    }
    screenHost.toggleAttribute('inert', dialogOpen);
    // a new screen: put focus on its heading so screen readers say where they are
    if (state.phase !== shownPhase && state.phase !== 'play' && state.phase !== 'result') {
      screenHost.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
    }
    shownPhase = state.phase;
  }

  // ---- starting a new game, always behind a confirmation ----
  function askNewGame(event?: Event) {
    if (dialogOpen) return;
    dialogOpen = true;
    // Where focus goes back to. Safari and iOS do not focus a button when it is
    // tapped, so the focused element can be the page itself: use the button that
    // was tapped, and only fall back to the focused element (the keyboard case).
    const opener = (event?.currentTarget as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
    screenHost.toggleAttribute('inert', true);
    notices.toggleAttribute('inert', true);
    const close = () => {
      dialogOpen = false;
      removeEventListener('keydown', onKey, true);
      scrim.remove();
      screenHost.toggleAttribute('inert', false);
      notices.toggleAttribute('inert', false);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const keep = el('button', { class: 'pp-btn', type: 'button', onclick: close }, 'Keep playing');
    const scrim: HTMLElement = el(
      'div',
      { class: 'pp-scrim', onclick: (e) => e.target === scrim && close() },
      el(
        'div',
        { class: 'pp-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'newgame-title', 'aria-describedby': 'newgame-text' },
        el('h2', { class: 'pp-heading', id: 'newgame-title' }, 'Start a new game?'),
        el('p', { class: 'pp-lead', id: 'newgame-text' }, 'Names and scores will be cleared.'),
        el(
          'div',
          { class: 'pp-actions' },
          keep,
          el(
            'button',
            {
              class: 'pp-btn alt',
              type: 'button',
              onclick: () => {
                close();
                dispatch({ type: 'newSession' });
              },
            },
            'New game',
          ),
        ),
      ),
    );
    addEventListener('keydown', onKey, true);
    host.append(scrim);
    keep.focus();
  }

  // ---- keep everything fitted to the screen ----
  const refit = () => relayout();
  new ResizeObserver(refit).observe(document.body);
  document.fonts.ready.then(refit);

  render();
}
