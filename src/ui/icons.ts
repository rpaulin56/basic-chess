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
 *
 * Le frecce sono due e non quattro. "Vai all'inizio" e "vai alla fine" non li usava
 * nessuno, e in una barra che su telefono va a capo ogni icona inutile si paga due
 * volte: occupa spazio e allunga la fila da percorrere per trovare quella che serve.
 * Ed e' sparita anche "Ritira la mossa", che non e' piu' un comando a se': si torna
 * indietro con la freccia e si rigioca.
 */

export type IconName =
  | 'previous'
  | 'next'
  | 'flip'
  | 'tutor'
  | 'tutorOff'
  | 'hint'
  | 'help'
  | 'resign'
  | 'draw'
  | 'settings'
  | 'position'
  | 'person'
  | 'newGame'
  | 'world';

/**
 * Ogni icona e' il contenuto di un viewBox 24x24. Tratto e riempimento sono decisi
 * dal CSS: le frecce di navigazione sono piene (si leggono meglio in piccolo), il
 * resto e' a filo.
 */

/**
 * La lampadina: "dammi un'idea". E' un pulsante, non un interruttore, e allora il
 * vetro puo' essere colorato senza entrare in conflitto con nessuno stato.
 */
const BULB =
  '<path class="glass" d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.2 1 2.2h5.2c.1-1 .4-1.7 1-2.2A6 6 0 0 0 12 3z" />' +
  '<path d="M9.5 18h5M10.5 21h3" />';

/**
 * Il fumetto: la Nonna che parla, sbarrato quando tace.
 *
 * Prima qui c'era la lampadina, ed era lo stesso disegno del comando "dammi un'idea":
 * due cose diverse con la stessa icona. La distinzione giusta e' che la lampadina e'
 * L'IDEA, mentre il fumetto e' LEI CHE PARLA — che e' esattamente cio' che
 * l'interruttore accende e spegne.
 */
const BUBBLE =
  '<path d="M6 4h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-5 4v-4H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />';

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
 *
 * Sono le uniche due icone a colori, e il motivo e' che sono le uniche due che NON
 * hanno uno stato: non si accendono mai, quindi il colore non deve competere con
 * niente (mentre sul tutor, che e' un interruttore, l'acceso si legge proprio dal
 * colore). Ed e' anche l'unica cosa che disegniamo che un colore ce l'ha davvero:
 * una scacchiera ha le case chiare e le case scure, e i pezzi sono bianchi e neri.
 */
const BOARD_FRAME =
  '<path d="M3 3h18v18H3z" />' +
  '<path class="sq" d="M3 3h4.5v4.5H3zM12 3h4.5v4.5H12zM7.5 7.5H12V12H7.5zM16.5 7.5H21V12h-4.5z' +
  'M3 12h4.5v4.5H3zM12 12h4.5v4.5H12zM7.5 16.5H12V21H7.5zM16.5 16.5H21V21h-4.5z" ' +
  'stroke="none"/>';

/**
 * Un pezzo: un punto pieno. Le sagome vere, a questa scala, sono macchie.
 * `shade` dice se e' un pezzo bianco o nero — a due punti di colore diverso non serve
 * nessuna didascalia per dire chi sta da che parte.
 */
function dot(x: number, y: number, shade: 'light' | 'dark', r = 1.15): string {
  return `<circle class="piece-${shade}" cx="${x}" cy="${y}" r="${r}"/>`;
}

const PATHS: Record<IconName, string> = {
  previous: '<path d="M15.5 5.5v13L7 12z" fill="currentColor"/>',
  next: '<path d="M8.5 5.5v13L17 12z" fill="currentColor"/>',
  // Due frecce che si scambiano: dice "gira" meglio di una freccia circolare, che in
  // 24 pixel si confonde con "ricarica".
  flip: '<path d="M8 20V4m0 0L5 7m3-3 3 3M16 4v16m0 0 3-3m-3 3-3-3" />',
  // Quando la Nonna tace il fumetto e' sbarrato: lo stato si legge dal DISEGNO e non
  // solo dal colore di sfondo, che chi guarda per la prima volta non sa interpretare
  // (e che a un daltonico non dice niente).
  tutor: BUBBLE,
  tutorOff: BUBBLE + '<path d="M4 20 20 4" />',
  // "Dammi un'idea": la lampadina.
  hint: BULB,
  // Punto interrogativo, non un punto interrogativo DENTRO UN CERCHIO: quello e'
  // l'icona universale della guida in linea, e questa non apre una guida — spiega
  // una scelta che si ha li' accanto.
  help:
    '<path d="M8.6 8.6a3.5 3.5 0 1 1 4.6 3.3c-1 .35-1.5 1.15-1.5 2.2v.5" />' +
    '<circle cx="11.7" cy="18.3" r="1.15" fill="currentColor" stroke="none" />',
  // Bandiera bianca: il gesto dell'abbandono in ogni sport. Il drappo e' pieno di
  // bianco e non solo contornato, perche' una bandiera bianca si riconosce se e'
  // bianca — era l'unico modo di dirlo, e per questo il colore qui ci sta.
  resign: '<path d="M6 3v18" /><path class="drape" d="M6 4.2h11l-2.4 3.6L17 11.4H6z" />',
  // Il mezzo punto, scritto. E' il modo in cui la patta si segna sul tabellone da
  // sempre: chi gioca a scacchi lo riconosce senza pensarci, e chi non lo riconosce
  // lo impara una volta sola (l'etichetta lo dice, al tocco e col puntatore).
  //
  // Unica icona con del TESTO dentro, ed e' una deroga consapevole al principio del
  // modulo — "il disegno e' identico ovunque" — perche' il glifo lo sceglie il font
  // di sistema e c'e' chi lo disegna con la barra obliqua e chi orizzontale. La
  // deroga vale la pena: qualunque disegno inventato da noi direbbe meno di questo
  // simbolo, che e' gia' la notazione ufficiale del risultato.
  //
  // "1/2-1/2" non entra: a ventidue pixel sarebbero sette caratteri, cioe' tre pixel
  // l'uno.
  draw:
    '<text x="12" y="17.5" text-anchor="middle" font-size="17" font-weight="600" ' +
    'font-family="system-ui, -apple-system, Segoe UI, sans-serif" ' +
    'fill="currentColor" stroke="none">½</text>',
  // Cursori: e' l'icona che ovunque significa "impostazioni". Un ingranaggio, a 20
  // pixel e a filo, diventa una rotella dentata illeggibile.
  settings:
    '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />' +
    '<circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="17" r="2" />',
  // Chi gioca. Il colore della sagoma lo decide il CSS (classe `body`): la stessa
  // icona serve per il Bianco e per il Nero.
  // Centrata: era spostata a sinistra per lasciare posto al robot che le stava
  // accanto, e da sola risultava storta nel suo riquadro.
  person:
    '<circle class="body" cx="12" cy="7" r="3.4" />' +
    '<path class="body" d="M5.4 19.6a6.6 6.6 0 0 1 13.2 0z" />',
  // Nuova partita: i due schieramenti allineati, ordinati e simmetrici. In alto i
  // Neri, in basso i Bianchi, come su una scacchiera vista dal Bianco.
  newGame:
    BOARD_FRAME +
    dot(6.2, 6.2, 'dark') + dot(10.1, 6.2, 'dark') + dot(13.9, 6.2, 'dark') + dot(17.8, 6.2, 'dark') +
    dot(6.2, 17.8, 'light') + dot(10.1, 17.8, 'light') + dot(13.9, 17.8, 'light') + dot(17.8, 17.8, 'light'),
  // Il mappamondo: la lingua. Tre elementi soli — il cerchio, l'equatore e un
  // meridiano — perche' a ventidue pixel un mappamondo con i continenti e' una
  // macchia. Non una bandiera: una bandiera dice UN PAESE, e l'inglese non e' il
  // paese di chi lo parla.
  world:
    '<circle cx="12" cy="12" r="9" />' +
    '<path d="M3 12h18" />' +
    '<path d="M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18z" />',
  // Posizione: gli stessi pezzi, ma sparsi come in una partita cominciata. Il
  // disordine e' il messaggio, quindi le posizioni sono scelte per non allinearsi
  // ne' in riga ne' in colonna.
  position:
    BOARD_FRAME +
    dot(7.1, 6.6, 'dark') + dot(13.4, 9.8, 'light') + dot(17.4, 6.9, 'dark') + dot(9.9, 16.4, 'light'),
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
