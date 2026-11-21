// The plain screens between rounds: names, setup, handoff and match over.
// Each is built from the paper pieces that already exist (name tags, cream
// cards, kraft chips, the snowman and sun) with live type, and no new art.
import {
  ANSWER_MAX_LENGTH,
  CATEGORY_IDS,
  CATEGORY_LABELS,
  DIFFICULTIES,
  MATCH_LENGTHS,
  MATCH_LENGTH_LABELS,
  MISS_LIMITS,
  charLength,
  currentGuesser,
  currentSetter,
  defaultDifficulty,
  type Action,
  type CategoryId,
  type Difficulty,
  type GameState,
  type MatchLength,
  type Reduction,
} from '../engine';
import { art } from '../paper/art';
import { placeYard } from '../paper/yard';
import { DIFFICULTY_LABELS, matchOverLines } from './copy';
import { el, type Child } from './dom';
import { renderHeader } from './header';

/** What a screen needs from the app. */
export interface ScreenContext {
  state: GameState;
  yard: HTMLImageElement;
  draft: SetupDraft;
  dispatch(action: Action): Reduction;
  askNewGame(): void;
  /** Take the setup form back to a round that was set but not yet played. */
  changeAnswer(): void;
}

export interface Screen {
  root: HTMLElement;
  layout(): void;
}

/** What the setter has typed so far. Kept in memory only, never saved. */
export interface SetupDraft {
  answer: string;
  category: CategoryId | null;
  custom: string;
  difficulty: Difficulty | null;
  hidden: boolean;
}

export const emptyDraft = (): SetupDraft => ({ answer: '', category: null, custom: '', difficulty: null, hidden: false });

// ---- shared pieces ----

function errorLine(): { node: HTMLElement; show(message: string | null): void } {
  const node = el('p', { class: 'pp-error', role: 'alert', hidden: true });
  return {
    node,
    show(message) {
      node.textContent = message ?? '';
      node.hidden = !message;
    },
  };
}

function button(label: string, onclick: () => void, kind: 'main' | 'alt' = 'main', type: 'button' | 'submit' = 'button') {
  return el('button', { class: kind === 'main' ? 'pp-btn' : 'pp-btn alt', type, onclick }, label);
}

interface Option<T extends string> {
  value: T;
  label: string;
  sub?: string;
}

/** A row of paper chips that works as radio buttons, so keyboards and screen readers get it for free. */
function chips<T extends string>(
  name: string,
  legend: string,
  options: Option<T>[],
  value: T | null,
  onChange: (value: T) => void,
): HTMLFieldSetElement {
  return el(
    'fieldset',
    { class: 'pp-field' },
    el('legend', {}, legend),
    el(
      'div',
      { class: 'pp-chips' },
      ...options.map((o) =>
        el(
          'label',
          { class: 'pp-chip' },
          el('input', { type: 'radio', name, value: o.value, class: 'pp-sr', checked: o.value === value, onchange: () => onChange(o.value) }),
          el('span', {}, o.label, o.sub ? el('small', {}, o.sub) : null),
        ),
      ),
    ),
  );
}

/** A page: the name tags (once a game has started), then a scrolling area. */
function page(ctx: ScreenContext, className: string, body: Child[], withTags: boolean): HTMLElement {
  const header = el('header', { class: 'pp-tags' });
  if (withTags) renderHeader(header, ctx.state, ctx.askNewGame);
  return el('div', { class: `pp-screen page ${className}` }, withTags ? header : null, el('div', { class: 'pp-scroll' }, ...body));
}

/** The snowman and sun standing in the yard, as on the play screen. */
function stage(): HTMLElement {
  return el(
    'div',
    { class: 'pp-stage', 'aria-hidden': 'true' },
    el('img', { class: 'pp-hero-sun', src: art('sun-smug'), alt: '' }),
    el('img', { class: 'pp-hero-snowman', src: art('snowman-0'), alt: '' }),
  );
}

function layoutWithStage(root: HTMLElement, yard: HTMLImageElement) {
  const box = root.querySelector('.pp-stage')?.getBoundingClientRect();
  // the grass line sits behind the snowman's middle, as on the play screen
  placeYard(yard, box ? box.bottom - box.height * 0.4 : innerHeight * 0.18);
}

// ---- names and match length ----

export function namesScreen(ctx: ScreenContext): Screen {
  let matchLength: MatchLength = ctx.state.matchLength;
  const first = el('input', { class: 'pp-input', name: 'first', autocomplete: 'off', autocapitalize: 'words', placeholder: 'Name' });
  const second = el('input', { class: 'pp-input', name: 'second', autocomplete: 'off', autocapitalize: 'words', placeholder: 'Name' });
  const problem = errorLine();
  const hints: Record<MatchLength, string> = {
    endless: 'Keep playing as long as you like.',
    one: 'One round each. The best score wins.',
    first2: 'The first to 2 points wins.',
    first3: 'The first to 3 points wins.',
  };
  const hint = el('p', { class: 'pp-hint' }, hints[matchLength]);
  const lengths = chips<MatchLength>(
    'length',
    'How long is the game?',
    MATCH_LENGTHS.map((value) => ({ value, label: MATCH_LENGTH_LABELS[value] })),
    matchLength,
    (value) => {
      matchLength = value;
      hint.textContent = hints[value];
    },
  );
  const form = el(
    'form',
    {
      class: 'pp-form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const result = ctx.dispatch({ type: 'start', names: [first.value, second.value], matchLength });
        if (result.error) problem.show(result.error.message);
      },
    },
    el('label', { class: 'pp-field' }, el('span', { class: 'pp-label' }, 'First player'), first),
    el('label', { class: 'pp-field' }, el('span', { class: 'pp-label' }, 'Second player'), second),
    lengths,
    hint,
    problem.node,
    button("Let's play", () => {}, 'main', 'submit'),
  );
  const card = el(
    'section',
    { class: 'pp-card' },
    el('h1', { class: 'pp-title' }, 'Meltdown'),
    el('p', { class: 'pp-lead' }, 'Guess the word before the snowman melts.'),
    form,
  );
  const root = page(ctx, 'names', [stage(), card], false);
  return { root, layout: () => layoutWithStage(root, ctx.yard) };
}

// ---- setting the secret ----

export function setupScreen(ctx: ScreenContext): Screen {
  const { state, draft } = ctx;
  const setter = state.players[currentSetter(state)!]!.name;
  const guesser = state.players[currentGuesser(state)!]!.name;
  draft.difficulty ??= defaultDifficulty(state);

  const problem = errorLine();
  const answer = el('input', {
    class: `pp-input secret${draft.hidden ? ' hide' : ''}`,
    name: 'answer',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
    'aria-describedby': 'answer-count',
  });
  answer.value = draft.answer;
  const count = el('span', { class: 'pp-count', id: 'answer-count' });
  const updateCount = () => {
    const n = charLength(answer.value.trim());
    count.textContent = `${n} of ${ANSWER_MAX_LENGTH}`;
    count.classList.toggle('over', n > ANSWER_MAX_LENGTH);
  };
  updateCount();
  answer.addEventListener('input', () => {
    draft.answer = answer.value;
    updateCount();
    problem.show(null);
  });
  const toggle = el(
    'button',
    {
      class: 'pp-toggle',
      type: 'button',
      'aria-pressed': draft.hidden,
      onclick: () => {
        draft.hidden = !draft.hidden;
        answer.classList.toggle('hide', draft.hidden);
        toggle.setAttribute('aria-pressed', String(draft.hidden));
        toggle.textContent = draft.hidden ? 'Show' : 'Hide';
      },
    },
    draft.hidden ? 'Show' : 'Hide',
  );

  const custom = el('input', {
    class: 'pp-input',
    name: 'category-other',
    autocomplete: 'off',
    placeholder: 'Type a category',
    'aria-label': 'Your own category',
  });
  custom.value = draft.custom;
  custom.addEventListener('input', () => {
    draft.custom = custom.value;
    problem.show(null);
  });
  const customBox = el('label', { class: 'pp-field pp-other', hidden: draft.category !== 'other' }, custom);
  const categories = chips<CategoryId>(
    'category',
    'What is it?',
    CATEGORY_IDS.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
    draft.category,
    (value) => {
      draft.category = value;
      customBox.hidden = value !== 'other';
      if (value === 'other') custom.focus();
      problem.show(null);
    },
  );
  const levels = chips<Difficulty>(
    'difficulty',
    'How hard?',
    DIFFICULTIES.map((value) => ({ value, label: DIFFICULTY_LABELS[value], sub: `${MISS_LIMITS[value]} wrong guesses` })),
    draft.difficulty,
    (value) => {
      draft.difficulty = value;
    },
  );
  levels.classList.add('three');

  const form = el(
    'form',
    {
      class: 'pp-form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const result = ctx.dispatch({
          type: 'submitPuzzle',
          puzzle: { answer: answer.value, category: { id: draft.category ?? '', custom: custom.value } },
          difficulty: draft.difficulty ?? 'normal',
        });
        if (result.error) problem.show(result.error.message);
      },
    },
    el(
      'div',
      { class: 'pp-field' },
      el('label', { class: 'pp-label', for: 'secret' }, 'The secret answer'),
      el('div', { class: 'pp-secretrow' }, answer, toggle),
      el('div', { class: 'pp-under' }, el('span', { class: 'pp-hint' }, 'Letters A to Z, up to 45 characters.'), count),
    ),
    categories,
    customBox,
    levels,
    problem.node,
    button('Done', () => {}, 'main', 'submit'),
  );
  answer.id = 'secret';
  const card = el(
    'section',
    { class: 'pp-card' },
    el('h1', { class: 'pp-heading' }, `${setter}, type a secret.`),
    el('p', { class: 'pp-lead' }, `${guesser} will guess it.`),
    form,
  );
  const root = page(ctx, 'setup', [card], true);
  return { root, layout: () => placeYard(ctx.yard, innerHeight * 0.2) };
}

// ---- passing the phone ----

export function handoffScreen(ctx: ScreenContext): Screen {
  const { state } = ctx;
  const round = state.round!;
  const guesser = state.players[round.guesser]!.name;
  const card = el(
    'section',
    { class: 'pp-card' },
    el('h1', { class: 'pp-heading' }, `Pass the phone to ${guesser}.`),
    el('p', { class: 'pp-lead' }, `${guesser}, it is your turn to guess.`),
    el(
      'p',
      { class: 'pp-level' },
      el('b', {}, DIFFICULTY_LABELS[round.difficulty]),
      `: the snowman melts after ${MISS_LIMITS[round.difficulty]} wrong guesses.`,
    ),
    el('div', { class: 'pp-actions' }, button("It's me", () => ctx.dispatch({ type: 'confirmHandoff' })), button('Change the answer', ctx.changeAnswer, 'alt')),
  );
  const root = page(ctx, 'handoff', [stage(), card], true);
  return { root, layout: () => layoutWithStage(root, ctx.yard) };
}

// ---- the match is over ----

export function matchOverScreen(ctx: ScreenContext): Screen {
  const { heading, note } = matchOverLines(ctx.state);
  const card = el(
    'section',
    { class: 'pp-card' },
    el('h1', { class: 'pp-heading big' }, heading),
    el('p', { class: 'pp-lead' }, note),
    el('div', { class: 'pp-actions' }, button('Rematch', () => ctx.dispatch({ type: 'rematch' })), button('New game', ctx.askNewGame, 'alt')),
  );
  const root = page(ctx, 'over', [stage(), card], true);
  return { root, layout: () => layoutWithStage(root, ctx.yard) };
}
