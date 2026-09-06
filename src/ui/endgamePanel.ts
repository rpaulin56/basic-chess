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
}

export function renderEndgamePanel(
  container: HTMLElement,
  endgame: Endgame | null,
  handlers: EndgameHandlers,
): void {
  container.replaceChildren();
  container.hidden = !endgame;
  if (!endgame) return;

  const heading = document.createElement('h2');
  heading.textContent = t(endgame.key);
  container.append(heading);

  const intro = document.createElement('p');
  intro.textContent = t('endgameIntro');
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
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = t('endgameClose');
  close.addEventListener('click', handlers.onClose);
  actions.append(close);
  container.append(actions);
}
