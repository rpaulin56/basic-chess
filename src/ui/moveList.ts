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

  const current = container.querySelector<HTMLElement>('button.current');
  if (current) reveal(container, current);
}

/**
 * Porta la mossa corrente dentro la parte visibile della lista, muovendo SOLO la
 * lista.
 *
 * Qui prima c'era `scrollIntoView`, ed era il difetto piu' grave dell'uso su
 * telefono. Quel metodo scorre tutti gli antenati necessari, PAGINA COMPRESA: in
 * colonna singola la lista sta sotto la scacchiera, quindi ad ogni mossa il browser
 * scorreva la pagina per mostrare la lista e si portava via la scacchiera. Si giocava
 * una mossa e bisognava risalire per vedere il risultato.
 *
 * `block: 'nearest'` non bastava a impedirlo: "nearest" riguarda QUANTO scorrere, non
 * SE farlo, e un elemento sotto la piega va comunque raggiunto.
 */
function reveal(container: HTMLElement, target: HTMLElement): void {
  const view = container.getBoundingClientRect();
  const item = target.getBoundingClientRect();
  if (item.top < view.top) container.scrollTop -= view.top - item.top;
  else if (item.bottom > view.bottom) container.scrollTop += item.bottom - view.bottom;
  if (item.left < view.left) container.scrollLeft -= view.left - item.left;
  else if (item.right > view.right) container.scrollLeft += item.right - view.right;
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
