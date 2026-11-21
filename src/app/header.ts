// The two name tags and the New game button, shown on every screen once a
// game has started. Same paper pieces as the play screen.
import { currentGuesser, currentSetter, scores, type GameState } from '../engine';
import { el } from './dom';
import { pointsLabel } from './copy';

export function renderHeader(header: HTMLElement, state: GameState, onNewGame: () => void) {
  const sc = scores(state);
  const setter = currentSetter(state);
  const guesser = currentGuesser(state);
  const showRoles = state.phase !== 'matchOver';
  // whose turn it is: the setter while setting, otherwise the guesser
  const active = state.phase === 'setup' ? setter : guesser;
  const tag = (index: number) => {
    const player = state.players[index]!;
    const role = !showRoles ? null : index === guesser ? 'guessing' : index === setter ? 'setting' : null;
    return el(
      'div',
      { class: `pp-tag${showRoles && index === active ? ' turn' : ''}`, title: player.name },
      el('span', { class: 'pp-name' }, player.name),
      el('span', { 'aria-label': pointsLabel(sc[index]!) }, sc[index]!),
      role ? el('small', {}, role) : null,
    );
  };
  header.replaceChildren(
    tag(0),
    el('button', { class: 'pp-menu', type: 'button', onclick: onNewGame }, 'New game'),
    tag(1),
  );
}
