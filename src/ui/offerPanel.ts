import { t } from '../i18n/index.js';
import type { DrawVerdict, ResignVerdict } from '../tutor/adjudicate.js';

/**
 * Il pannello dell'abbandono e dell'offerta di patta.
 *
 * E' l'unico posto del programma in cui succede uno SCAMBIO: tu proponi qualcosa e
 * l'avversaria risponde. Per questo e' anche l'unico in cui parla in prima persona
 * senza mezzi termini — "no, secondo me sto meglio io" — mentre altrove si limita a
 * spiegare la scacchiera.
 *
 * Il giudizio arriva sempre PRIMA della decisione, e se l'abbandono e' prematuro la
 * partita non si chiude: resta un secondo pulsante per confermare. E' la stessa regola
 * del ritiro della mossa — qui si prova, non si scommette — e vale anche dopo: la
 * freccia indietro riapre una partita abbandonata.
 */

export type OfferKind = 'resign' | 'draw';

export interface OfferView {
  readonly kind: OfferKind;
  /** Vero mentre l'avversaria sta guardando la posizione. */
  readonly thinking: boolean;
  readonly resign?: ResignVerdict;
  readonly draw?: DrawVerdict;
  /** Risposta all'offerta di patta: null finche' non e' stata fatta davvero. */
  readonly accepted?: boolean | null;
}

export interface OfferHandlers {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const RESIGN_TEXT: Record<ResignVerdict, string> = {
  winning: 'resignWinning',
  balanced: 'resignBalanced',
  worse: 'resignWorse',
  hopeless: 'resignHopeless',
};

const DRAW_TEXT: Record<DrawVerdict, string> = {
  tooEarly: 'drawTooEarly',
  winning: 'drawWinning',
  balanced: 'drawBalanced',
  worse: 'drawWorse',
  hopeless: 'drawHopeless',
};

export function renderOfferPanel(
  container: HTMLElement,
  view: OfferView | null,
  handlers: OfferHandlers,
): void {
  container.replaceChildren();
  container.hidden = !view;
  if (!view) return;

  const heading = document.createElement('h2');
  heading.textContent = t(view.kind === 'resign' ? 'resignHeading' : 'drawHeading');
  container.append(heading);

  if (view.thinking) {
    container.append(paragraph(t('hintThinking')));
    return;
  }

  const actions = document.createElement('div');
  actions.className = 'tutor-actions';

  if (view.kind === 'resign') {
    const verdict = view.resign ?? 'balanced';
    container.append(paragraph(t(RESIGN_TEXT[verdict])));
    // Quando l'abbandono e' giustificato il pulsante principale e' quello, altrimenti
    // e' il ripensamento: il tasto in evidenza deve essere quello che il tutor
    // consiglia, o il consiglio e' solo una frase.
    const justified = verdict === 'hopeless';
    actions.append(
      action(t('resignConfirm'), handlers.onConfirm, justified ? 'primary' : ''),
      action(t('resignCancel'), handlers.onCancel, justified ? '' : 'primary'),
    );
  } else {
    const verdict = view.draw ?? 'balanced';
    container.append(paragraph(t(DRAW_TEXT[verdict])));
    if (view.accepted === true) container.append(said(t('drawAccepted')));
    else if (view.accepted === false) container.append(said(t('drawRefused')));
    actions.append(action(t('offerClose'), handlers.onCancel, 'primary'));
  }

  container.append(actions);
}

function paragraph(content: string): HTMLElement {
  const element = document.createElement('p');
  element.textContent = content;
  return element;
}

/** La risposta dell'avversaria, distinta dal giudizio: sono due voci diverse. */
function said(content: string): HTMLElement {
  const element = document.createElement('p');
  element.className = 'offer-said';
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
