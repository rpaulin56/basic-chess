import { moveNumberOf, type GameState } from '../core/game.js';
import { toFigurine } from '../core/notation.js';
import { t } from '../i18n/index.js';

/**
 * Lista mosse in notazione a figure, cliccabile (ogni mossa e' un punto di rewind).
 * Il testo delle mosse non passa da i18n: la notazione a figure e' gia' universale.
 */
export function renderMoveList(
  container: HTMLElement,
  state: GameState,
  onSeek: (cursor: number) => void,
): void {
  container.replaceChildren();

  if (state.plies.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = t('noMoves');
    container.append(empty);
    return;
  }

  const list = document.createElement('ol');
  // Se la partita inizia con il Nero al tratto (posizione da PGN), la prima riga ha
  // un segnaposto al posto della mossa del Bianco.
  const startsBlack = state.startFen.split(' ')[1] === 'b';

  let index = 0;
  if (startsBlack) {
    const row = document.createElement('li');
    row.append(numberCell(moveNumberOf(state, 0)), placeholder(), moveButton(state, 0, onSeek));
    list.append(row);
    index = 1;
  }
  for (; index < state.plies.length; index += 2) {
    const row = document.createElement('li');
    row.append(numberCell(moveNumberOf(state, index)), moveButton(state, index, onSeek));
    if (index + 1 < state.plies.length) row.append(moveButton(state, index + 1, onSeek));
    list.append(row);
  }
  container.append(list);

  // Anche `inline`: su telefono la lista e' una striscia ORIZZONTALE, e senza questo
  // la mossa corrente restava fuori dal bordo destro senza che nulla lo segnalasse.
  const current = container.querySelector('button.current');
  current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function numberCell(moveNumber: number): HTMLElement {
  const span = document.createElement('span');
  span.className = 'num';
  span.textContent = `${moveNumber}.`;
  return span;
}

function placeholder(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'placeholder';
  span.textContent = '…';
  return span;
}

function moveButton(state: GameState, index: number, onSeek: (cursor: number) => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = toFigurine(state.plies[index]!.san);
  // Il cursore "dopo la mossa index" vale index + 1.
  if (state.cursor === index + 1) button.classList.add('current');
  button.addEventListener('click', () => onSeek(index + 1));
  return button;
}
