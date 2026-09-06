/**
 * Icone della barra dei comandi.
 *
 * Sono SVG scritti a mano, non emoji e non un font di icone: le emoji cambiano
 * disegno (e ingombro) da un sistema all'altro, un font sarebbe un file in piu' da
 * scaricare. Qui il disegno e' identico ovunque, si tinge da solo con `currentColor`
 * e pesa qualche centinaio di byte.
 *
 * Il criterio per cui un comando merita un'icona invece di una parola: se cliccarlo
 * per sbaglio non rompe niente. Ruotare la scacchiera si annulla ruotandola di nuovo;
 * "Nuova partita" no, e infatti resta un pulsante con la sua brava etichetta.
 */

export type IconName =
  | 'first'
  | 'previous'
  | 'next'
  | 'last'
  | 'flip'
  | 'tutor'
  | 'pgn'
  | 'fen'
  | 'newGame';

/**
 * Ogni icona e' il contenuto di un viewBox 24x24. Tratto e riempimento sono decisi
 * dal CSS: le frecce di navigazione sono piene (si leggono meglio in piccolo), il
 * resto e' a filo.
 */
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
  // Foglio scritto: il PGN e' il testo della partita.
  pgn: '<path d="M13 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" /><path d="M13 3v5h5M9 13h6M9 17h4" />',
  // Scacchiera in miniatura: il FEN e' una fotografia della posizione. Le case scure
  // sono quadrati pieni e non tratteggi: a 20 pixel un disegno a filo diventa poltiglia.
  fen:
    '<path d="M4 4h16v16H4z" />' +
    '<path d="M4 4h4v4H4zM12 4h4v4h-4zM8 8h4v4H8zM16 8h4v4h-4zM4 12h4v4H4zM12 12h4v4h-4zM8 16h4v4H8zM16 16h4v4h-4z" fill="currentColor" fill-opacity=".3" stroke="none"/>',
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
