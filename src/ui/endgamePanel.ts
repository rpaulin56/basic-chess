import { t } from '../i18n/index.js';
import type { Endgame } from '../endgame/endgame.js';

/**
 * La scheda del finale tipico.
 *
 * Non e' il tutor: non giudica niente e non dice cosa giocare. Dice soltanto che la
 * posizione che si ha davanti ha un nome e una teoria, e dove andarsela a studiare.
 * E' l'unico punto del programma che manda l'utente fuori, ed e' deliberato: sui
 * finali elementari esiste materiale fatto meglio di quanto potremmo farlo noi, e
 * rifarlo peggio non aiuterebbe nessuno.
 *
 * I link si aprono in una scheda nuova: chi sta studiando un finale sta anche
 * giocando una partita, e portargliela via sarebbe un dispetto.
 */

export interface EndgameHandlers {
  readonly onClose: () => void;
  readonly onSwap: () => void;
}

export interface EndgameView {
  readonly endgame: Endgame;
  /**
   * Vero se il finale non c'e' ancora e ci si puo' arrivare con un cambio.
   *
   * E' il momento didatticamente prezioso: la domanda "questo cambio mi conviene?" si
   * risponde sapendo com'e' fatto il finale che ne esce, e chi comincia non sa nemmeno
   * che quella domanda esiste. La scheda dice solo QUALE finale, mai quale mossa: dire
   * la mossa sarebbe giocare al posto suo.
   */
  readonly entering: boolean;
  /**
   * La proposta che accompagna il finale, quando la partita e' ormai decisa.
   *
   * `swap`: sta vincendo lei, e ti propone di studiare e poi passare dall'altra parte.
   * E' il momento piu' sprecato di una partita — sai gia' come finisce e giochi solo
   * per arrivare in fondo — trasformato nell'esercizio migliore che ci sia.
   *
   * `convert`: stai vincendo tu, e ti offre la tecnica. Non c'e' niente da girare: la
   * posizione da convertire ce l'hai gia' davanti, e te la sei guadagnata sul campo.
   */
  readonly challenge?: 'swap' | 'convert' | null;
}

export function renderEndgamePanel(
  container: HTMLElement,
  view: EndgameView | null,
  handlers: EndgameHandlers,
): void {
  container.replaceChildren();
  container.hidden = !view;
  if (!view) return;
  const { endgame, entering } = view;

  const heading = document.createElement('h2');
  heading.textContent = t(endgame.key);
  container.append(heading);

  const intro = document.createElement('p');
  intro.textContent = t(
    view.challenge === 'swap'
      ? 'endgameSwapIntro'
      : view.challenge === 'convert'
        ? 'endgameConvertIntro'
        : entering
          ? 'endgameEnteringIntro'
          : 'endgameIntro',
  );
  container.append(intro);

  const list = document.createElement('ul');
  list.className = 'endgame-links';
  for (const resource of endgame.resources) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = resource.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = resource.label;
    item.append(link);
    // Le risorse interattive si distinguono da quelle da leggere: sapere in anticipo
    // se ti aspetta un testo o una posizione da giocare cambia se ci clicchi adesso.
    if (resource.practice) {
      const tag = document.createElement('span');
      tag.className = 'endgame-practice';
      tag.textContent = t('endgamePractice');
      item.append(' ', tag);
    }
    list.append(item);
  }
  container.append(list);

  const actions = document.createElement('div');
  actions.className = 'tutor-actions';
  if (view.challenge === 'swap') {
    const swap = document.createElement('button');
    swap.type = 'button';
    swap.className = 'primary';
    swap.textContent = t('endgameSwapAction');
    swap.addEventListener('click', handlers.onSwap);
    actions.append(swap);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = t(view.challenge === 'swap' ? 'endgameSwapDecline' : 'endgameClose');
  close.addEventListener('click', handlers.onClose);
  actions.append(close);
  container.append(actions);
}
