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
  | 'tutorOff'
  | 'hint'
  | 'undo'
  | 'resign'
  | 'draw'
  | 'settings'
  | 'position'
  | 'person'
  | 'bot'
  | 'newGame';

/**
 * Ogni icona e' il contenuto di un viewBox 24x24. Tratto e riempimento sono decisi
 * dal CSS: le frecce di navigazione sono piene (si leggono meglio in piccolo), il
 * resto e' a filo.
 */

/** La lampadina, con e senza sbarra. */
const BULB =
  '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.2 1 2.2h5.2c.1-1 .4-1.7 1-2.2A6 6 0 0 0 12 3z" />';

/**
 * Le due scacchiere: quella schierata e quella in mezzo alla partita.
 *
 * Funzionano IN COPPIA, ed e' il motivo per cui funzionano. Una scacchiera puntinata
 * da sola non dice "nuova partita" — l'avevamo provata e non si leggeva. Messa
 * accanto a una scacchiera con i pezzi sparsi, la differenza fra ordine e disordine
 * dice "inizio" contro "partita in corso" senza bisogno di nessun simbolo astratto.
 *
 * Le case scure sono un motivo 4x4 e non 8x8: a ventidue pixel una scacchiera vera
 * diventa un retino grigio, e resta solo un quadrato sporco.
 */
const BOARD_FRAME =
  '<path d="M3 3h18v18H3z" />' +
  '<path d="M3 3h4.5v4.5H3zM12 3h4.5v4.5H12zM7.5 7.5H12V12H7.5zM16.5 7.5H21V12h-4.5z' +
  'M3 12h4.5v4.5H3zM12 12h4.5v4.5H12zM7.5 16.5H12V21H7.5zM16.5 16.5H21V21h-4.5z" ' +
  'fill="currentColor" fill-opacity=".15" stroke="none"/>';

/** Un pezzo: un punto pieno. Le sagome vere, a questa scala, sono macchie. */
function dot(x: number, y: number, r = 1.15): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
}

const PATHS: Record<IconName, string> = {
  first: '<path d="M17 5.5v13L9 12z" fill="currentColor"/><path d="M6.5 5.5v13" />',
  previous: '<path d="M15.5 5.5v13L7 12z" fill="currentColor"/>',
  next: '<path d="M8.5 5.5v13L17 12z" fill="currentColor"/>',
  last: '<path d="M7 5.5v13L15 12z" fill="currentColor"/><path d="M17.5 5.5v13" />',
  // Due frecce che si scambiano: dice "gira" meglio di una freccia circolare, che in
  // 24 pixel si confonde con "ricarica".
  flip: '<path d="M8 20V4m0 0L5 7m3-3 3 3M16 4v16m0 0 3-3m-3 3-3-3" />',
  // Lampadina: il tutor e' un suggerimento, non un giudice. Quando e' spento e'
  // sbarrata: lo stato si legge dal DISEGNO e non solo dal colore di sfondo, che chi
  // guarda per la prima volta non sa interpretare (e che a un daltonico non dice
  // niente).
  tutor: BULB,
  // Punto interrogativo, non un punto interrogativo DENTRO UN CERCHIO: quello e'
  // l'icona universale della guida in linea, e questo non apre una guida — fa una
  // domanda sulla posizione che si ha davanti.
  hint:
    '<path d="M8.6 8.6a3.5 3.5 0 1 1 4.6 3.3c-1 .35-1.5 1.15-1.5 2.2v.5" />' +
    '<circle cx="11.7" cy="18.3" r="1.15" fill="currentColor" stroke="none" />',
  tutorOff: BULB + '<path d="M4 20 20 4" />',
  // Freccia che torna indietro: e' il gesto "annulla" ovunque. Non e' una freccia di
  // navigazione (quelle sono piene e triangolari): questa cambia la partita.
  undo: '<path d="M4.5 9.5h9a5.5 5.5 0 0 1 0 11H8" /><path d="M8.5 5 4 9.5 8.5 14" />',
  // Bandiera ammainata: e' il gesto dell'abbandono in ogni sport. Non una bandiera
  // bianca disegnata (a ventidue pixel il colore non si vede) ma l'asta con il drappo.
  resign: '<path d="M6 3v18" /><path d="M6 4.2h11l-2.4 3.6L17 11.4H6z" />',
  // Il mezzo punto: e' cosi' che la patta si scrive sul tabellone, e non ha bisogno di
  // nessuna metafora. Due mani che si stringono, a questa dimensione, sono una macchia.
  draw:
    '<path d="M7.6 4.6h2.2l-3.4 5.2h3.6" />' +
    '<path d="M13.2 20.4 18.6 3.6" />' +
    '<path d="M14.6 14.2h4.8M17 12.4v3.6" fill="none" />' +
    '<circle cx="16.9" cy="18.6" r="1.7" />',
  // Cursori: e' l'icona che ovunque significa "impostazioni". Un ingranaggio, a 20
  // pixel e a filo, diventa una rotella dentata illeggibile.
  settings:
    '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />' +
    '<circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="17" r="2" />',
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
  // Nuova partita: i due schieramenti allineati, ordinati e simmetrici.
  newGame:
    BOARD_FRAME +
    dot(6.2, 6.2) + dot(10.1, 6.2) + dot(13.9, 6.2) + dot(17.8, 6.2) +
    dot(6.2, 17.8) + dot(10.1, 17.8) + dot(13.9, 17.8) + dot(17.8, 17.8),
  // Posizione: gli stessi pezzi, ma sparsi come in una partita cominciata. Il
  // disordine e' il messaggio, quindi le posizioni sono scelte per non allinearsi
  // ne' in riga ne' in colonna.
  position:
    BOARD_FRAME +
    dot(7.1, 6.6) + dot(13.4, 9.8) + dot(17.4, 6.9) + dot(9.9, 16.4),
};

export function createIcon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
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
