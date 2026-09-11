import { toFigurine } from '../core/notation.js';
import { t } from '../i18n/index.js';
import type { Continuation } from '../openings/openings.js';
import type { Hint } from '../tutor/hint.js';
import type { Explanation } from '../tutor/positional.js';

/**
 * Il pannello di "E adesso?".
 *
 * Due livelli, sempre: il primo dice di che tipo di posizione si tratta e quante mosse
 * ci sono, il secondo — solo se lo chiedi — dice quali. Non e' un vezzo: fra il primo
 * e il secondo clic c'e' l'unico momento in cui puoi ancora provare a rispondere da
 * solo, ed e' li' che si impara. Vale anche per le aperture, dove il primo livello
 * ("da qui la teoria conosce tre continuazioni") dice gia' una cosa vera e utile: che
 * sei a un bivio.
 */

export interface HintView {
  /** Vero mentre il motore sta ancora cercando. */
  readonly loading: boolean;
  /** Le continuazioni conosciute; se ce ne sono, la risposta viene dal libro. */
  readonly book: readonly Continuation[];
  /** Vero se la posizione era in teoria e la teoria finisce qui. */
  readonly leavingBook: boolean;
  readonly hint: Hint | null;
  readonly orientation: readonly Explanation[];
  readonly revealed: boolean;
}

export interface HintHandlers {
  readonly onReveal: () => void;
  readonly onClose: () => void;
}

export function renderHintPanel(
  container: HTMLElement,
  view: HintView | null,
  handlers: HintHandlers,
): void {
  container.replaceChildren();
  container.hidden = !view;
  if (!view) return;

  const heading = document.createElement('h2');
  heading.textContent = t('hintHeading');
  container.append(heading);

  if (view.loading) {
    container.append(paragraph(t('hintThinking')));
    return;
  }

  if (view.book.length > 0) {
    container.append(
      paragraph(
        view.book.length === 1
          ? t('hintBookOne')
          : t('hintBookMany', { count: view.book.length }),
      ),
    );
    if (view.revealed) container.append(bookList(view.book));
  } else if (view.hint) {
    if (view.leavingBook) container.append(paragraph(t('hintLeavingBook')));
    container.append(paragraph(shapeText(view.hint)));
    for (const reason of view.orientation) container.append(paragraph(t(reason.key, reason.params)));
    if (view.revealed) {
      container.append(moveList(view.hint.moves));
      // "Nessuna di queste e' la migliore" ha senso solo se "queste" sono piu' d'una: con
      // una mossa obbligata la nota contraddiceva l'elenco (segnalato giocando).
      if (view.hint.moves.length > 1) container.append(note(t('hintUnordered')));
    }
  } else {
    container.append(paragraph(t('hintNothing')));
  }

  const actions = document.createElement('div');
  actions.className = 'tutor-actions';
  if (!view.revealed && (view.book.length > 0 || view.hint)) {
    actions.append(
      action(
        view.hint?.shape === 'only' ? t('hintRevealOne') : t('hintReveal'),
        handlers.onReveal,
        'primary',
      ),
    );
  }
  actions.append(action(t('hintClose'), handlers.onClose));
  container.append(actions);
}

function shapeText(hint: Hint): string {
  if (hint.shape === 'only') return t('hintOnly');
  if (hint.shape === 'few') return t('hintFew', { count: hint.count });
  // Quando il conteggio ha toccato il tetto della ricerca il numero non e'
  // un'informazione: "20+" vuol dire soltanto che ne abbiamo chieste venti. In quel
  // caso si dice la cosa vera senza numero — che la posizione non si decide adesso —
  // invece di esibire una precisione che non c'e'.
  return hint.atLeast ? t('hintManyOpen') : t('hintMany', { count: hint.count });
}

function bookList(book: readonly Continuation[]): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'hint-book';
  for (const entry of book) {
    const item = document.createElement('li');
    const move = document.createElement('span');
    move.className = 'hint-move';
    move.textContent = toFigurine(entry.san);
    const name = document.createElement('span');
    name.className = 'hint-name';
    name.textContent = entry.name;
    item.append(move, name);
    list.append(item);
  }
  return list;
}

/** Quante mosse si mostrano davvero. Oltre, l'elenco smette di essere leggibile e
 *  diventa la lista delle mosse legali, che il giocatore ha gia' davanti. */
const MAX_SHOWN = 14;

function moveList(moves: readonly string[]): HTMLElement {
  const list = document.createElement('p');
  list.className = 'hint-moves';
  const shown = moves.slice(0, MAX_SHOWN).map(toFigurine).join(' · ');
  list.textContent = moves.length > MAX_SHOWN ? `${shown} ${t('hintMore')}` : shown;
  return list;
}

function paragraph(content: string): HTMLElement {
  const element = document.createElement('p');
  element.textContent = content;
  return element;
}

function note(content: string): HTMLElement {
  const element = document.createElement('p');
  element.className = 'hint-note';
  element.textContent = content;
  return element;
}

function action(label: string, onClick: () => void, className = ''): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  if (className) element.className = className;
  element.addEventListener('click', onClick);
  return element;
}
