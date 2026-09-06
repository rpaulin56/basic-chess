/**
 * Icone della barra dei comandi.
 *
 * Sono SVG scritti a mano, non emoji e non un font di icone: le emoji cambiano
 * disegno (e ingombro) da un sistema all'altro, un font sarebbe un file in piu' da
 * scaricare. Qui il disegno e' identico ovunque, si tinge da solo con `currentColor`
 * e pesa qualche centinaio di byte.
 *
 * Il criterio per cui un comando merita un'icona invece di una parola: se cliccarlo
 * per sbaglio non rompe niente, o se una conferma esplicita lo rende innocuo.
 * "Nuova partita" fa perdere la partita, ma chiede conferma, e allora l'icona basta:
 * a restare un pulsante con l'etichetta e' solo "Ritira mossa", che agisce subito.
 */

export type IconName =
  | 'first'
  | 'previous'
  | 'next'
  | 'last'
  | 'flip'
  | 'tutor'
  | 'settings'
  | 'export'
  | 'import'
  | 'person'
  | 'bot'
  | 'newGame';

/**
 * Ogni icona e' il contenuto di un viewBox 24x24. Tratto e riempimento sono decisi
 * dal CSS: le frecce di navigazione sono piene (si leggono meglio in piccolo), il
 * resto e' a filo.
 */
/** Scacchiera in miniatura, condivisa da "esporta" e "importa": in entrambi i casi
 *  cio' che viaggia e' una posizione. Le case scure sono quadrati pieni e non
 *  tratteggi, che a venti pixel diventano poltiglia. */
const BOARD_MINI =
  '<path d="M3.5 5h11v11h-11z" />' +
  '<path d="M3.5 5h3.7v3.7H3.5zM10.8 5h3.7v3.7h-3.7zM7.15 8.7h3.7v3.6h-3.7zM3.5 12.3h3.7v3.7H3.5zM10.8 12.3h3.7v3.7h-3.7z" fill="currentColor" fill-opacity=".3" stroke="none"/>';

const PATHS: Record<IconName, string> = {
  first: '<path d="M17 5.5v13L9 12z" fill="currentColor"/><path d="M6.5 5.5v13" />',
  previous: '<path d="M15.5 5.5v13L7 12z" fill="currentColor"/>',
  next: '<path d="M8.5 5.5v13L17 12z" fill="currentColor"/>',
  last: '<path d="M7 5.5v13L15 12z" fill="currentColor"/><path d="M17.5 5.5v13" />',
  // Due frecce che si scambiano: dice "gira" meglio di una freccia circolare, che in
  // 24 pixel si confonde con "ricarica".
  flip: '<path d="M8 20V4m0 0L5 7m3-3 3 3M16 4v16m0 0 3-3m-3 3-3-3" />',
  // Lampadina: il tutor e' un suggerimento, non un giudice.
  tutor:
    '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.2 1 2.2h5.2c.1-1 .4-1.7 1-2.2A6 6 0 0 0 12 3z" />',
  // Cursori: e' l'icona che ovunque significa "impostazioni". Un ingranaggio, a 20
  // pixel e a filo, diventa una rotella dentata illeggibile.
  settings:
    '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />' +
    '<circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="17" r="2" />',
  // Esporta e importa sono la STESSA scacchiera con la freccia girata: sono la stessa
  // operazione in due versi, e due disegni diversi lo nasconderebbero.
  export: BOARD_MINI + '<path d="M19 21v-9m0 0-2.4 2.4M19 12l2.4 2.4" />',
  import: BOARD_MINI + '<path d="M19 12v9m0 0-2.4-2.4M19 21l2.4-2.4" />',
  // Chi gioca e chi risponde. Il colore delle due sagome lo decide il CSS (classe
  // `body`): la stessa icona serve per il pezzo bianco e per quello nero.
  person:
    '<circle class="body" cx="11" cy="7" r="3.4" />' +
    '<path class="body" d="M4.4 19.6a6.6 6.6 0 0 1 13.2 0z" />',
  bot:
    '<path d="M11 2.6v2.6" />' +
    '<rect class="body" x="3.6" y="5.4" width="14.8" height="11.6" rx="3" />' +
    '<circle class="eye" cx="8.2" cy="11.2" r="1.3" stroke="none" />' +
    '<circle class="eye" cx="13.8" cy="11.2" r="1.3" stroke="none" />',
  // Scacchiera con i due eserciti schierati: la posizione iniziale. Puntini e non
  // sagome di pezzi, che a venti pixel diventerebbero macchie.
  newGame:
    '<path d="M4 4h16v16H4z" />' +
    '<g fill="currentColor" stroke="none">' +
    '<circle cx="7.5" cy="7.2" r="1.15"/><circle cx="10.5" cy="7.2" r="1.15"/>' +
    '<circle cx="13.5" cy="7.2" r="1.15"/><circle cx="16.5" cy="7.2" r="1.15"/>' +
    '<circle cx="7.5" cy="16.8" r="1.15"/><circle cx="10.5" cy="16.8" r="1.15"/>' +
    '<circle cx="13.5" cy="16.8" r="1.15"/><circle cx="16.5" cy="16.8" r="1.15"/>' +
    '</g>',
};

export function createIcon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // Decorativa: il significato lo porta l'aria-label del pulsante che la contiene.
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name];
  return svg;
}
