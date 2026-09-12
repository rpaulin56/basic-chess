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
  | 'strength'
  | 'resign'
  | 'draw'
  | 'settings'
  | 'position'
  | 'person'
  | 'newGame'
  | 'world'
  | 'replay'
  | 'eye'
  | 'book';

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

const PATHS: Record<IconName, string> = {
  previous: '<path d="M15.5 5.5v13L7 12z" fill="currentColor"/>',
  next: '<path d="M8.5 5.5v13L17 12z" fill="currentColor"/>',
  // Due archi che si rincorrono: e' il simbolo della ROTAZIONE, ed e' quello giusto
  // perche' la scacchiera gira, non si scambia.
  //
  // Prima c'erano due frecce dritte su e giu'. Le avevo scelte temendo che un simbolo
  // circolare si confondesse con "ricarica la pagina" — timore ragionevole allora,
  // infondato adesso: in tutta la barra non c'e' nessun comando di ricarica con cui
  // confondersi, e "su e giu'" dice "scambia due cose", che non e' quello che succede.
  flip:
    '<path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3" /><path d="M17.5 3.4v3.8h-3.8" />' +
    '<path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3" /><path d="M6.5 20.6V16.8h3.8" />',
  // Quando la Nonna tace il fumetto e' sbarrato: lo stato si legge dal DISEGNO e non
  // solo dal colore di sfondo, che chi guarda per la prima volta non sa interpretare
  // (e che a un daltonico non dice niente).
  tutor: BUBBLE,
  tutorOff: BUBBLE + '<path d="M4 20 20 4" />',
  // "Dammi un'idea": la lampadina.
  hint: BULB,
  // Il bilanciere: quanto forte vuoi la Nonna.
  //
  // Sostituisce due menu a tendina e un punto interrogativo — tre oggetti larghi in
  // una riga sotto la scacchiera, per una scelta che si fa a inizio partita e poi non
  // si tocca piu'. Un peso da sollevare dice "forza" senza parole e in qualunque
  // lingua, e apre il pannello dove la scelta si fa davvero, spiegazioni comprese.
  strength: '<path d="M3 9.5v5M6.5 7v10M17.5 7v10M21 9.5v5M6.5 12h11" />',
  // Il Re rovesciato: il gesto dell'abbandono negli SCACCHI, non nello sport in
  // generale.
  //
  // Era una bandiera bianca, e non funzionava: il bianco su fondo quasi bianco non si
  // vede, quindi restava una bandiera contornata — cioe' una bandiera qualunque. Il
  // problema non era il disegno ma la metafora, che chiedeva al colore di portare
  // tutto il significato. Un Re caduto non ha bisogno di nessun colore.
  //
  // COMPLETAMENTE ORIZZONTALE, e senza la linea del terreno. La prima versione era
  // inclinata di sessantacinque gradi con il pavimento sotto: il pavimento serviva a
  // dire "e' caduto e non e' storto", ma a ventidue pixel aggiungeva un tratto lungo
  // quanto tutta l'icona, e quel tratto era la cosa piu' visibile del disegno. Un Re
  // steso del tutto lo dice da solo: se e' orizzontale non puo' essere in piedi.
  //
  // La traslazione centra la figura nel riquadro: ruotando attorno alla base il pezzo
  // finisce in basso a sinistra, e senza correzione l'icona pende da una parte.
  resign:
    '<g transform="translate(6 -7) rotate(-90 13 19)">' +
    '<path d="M10 19h6" />' +
    '<path d="M10.8 19 12 12.6h2L15.2 19z" />' +
    '<circle cx="13" cy="11" r="1.6" />' +
    '<path d="M13 6.6v2.2M11.7 7.7h2.6" />' +
    '</g>',
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
  // Nuova partita: una damiera 3x3, e basta.
  //
  // Era una scacchiera 4x4 con otto pezzi schierati, disegnata per leggersi IN COPPIA
  // con quella coi pezzi sparsi di "posizione". Quella coppia non esiste piu' — la
  // posizione e' diventata un foglio di testo — e senza il confronto gli otto pallini
  // erano solo affollamento: a ventidue pixel un pezzo e' un punto, e otto punti sono
  // un retino.
  //
  // Tre caselle per lato invece di quattro: le case diventano di sette pixel invece
  // che di cinque, e la scacchiera si legge come scacchiera invece che come griglia
  // grigia. Il motivo alternato e' l'unica cosa che serve — un tabellone a scacchi
  // dice "una partita" senza bisogno di pezzi sopra.
  newGame:
    '<path d="M3 3h18v18H3z" />' +
    '<path class="sq" d="M3 3h6v6H3zM15 3h6v6h-6zM9 9h6v6H9zM3 15h6v6H3zM15 15h6v6h-6z" stroke="none"/>',
  // Il mappamondo: la lingua. Tre elementi soli — il cerchio, l'equatore e un
  // meridiano — perche' a ventidue pixel un mappamondo con i continenti e' una
  // macchia. Non una bandiera: una bandiera dice UN PAESE, e l'inglese non e' il
  // paese di chi lo parla.
  world:
    '<circle cx="12" cy="12" r="9" />' +
    '<path d="M3 12h18" />' +
    '<path d="M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18z" />',
  // Rivedi: una freccia sola che torna indietro, con il triangolo del "play" dentro.
  //
  // Una freccia circolare da sola si confonderebbe con "gira la scacchiera", che di
  // archi ne ha due. Il triangolo e' cio' che la distingue, ed e' anche la cosa vera:
  // non riporta soltanto all'inizio, fa ripartire la riproduzione.
  replay:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />' +
    '<path d="M3 3v5h5" />' +
    '<path d="M10 9v6l5-3z" fill="currentColor" />',
  // L'occhio della Nonna attenta: compare sul bilanciere SOLO quando lo e'.
  //
  // Occhio aperto contro palpebra abbassata era la prima idea, ma a dodici pixel la
  // differenza sta in un paio di pixel e non si legge. C'e' o non c'e' si legge sempre.
  eye:
    '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />' +
    '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />',
  // Il librone aperto della modalita' studio: due pagine e la costola in mezzo.
  //
  // Serve come INDICATORE oltre che come comando: acceso lo studio, la Nonna tace e i
  // ripensamenti non contano, e chi non se lo ricorda deve poterlo vedere sullo schermo
  // senza riaprire il riquadro.
  book:
    '<path d="M12 6.5c-1.8-1.3-4-2-6.5-2H3v13h2.5c2.5 0 4.7.7 6.5 2" />' +
    '<path d="M12 6.5c1.8-1.3 4-2 6.5-2H21v13h-2.5c-2.5 0-4.7.7-6.5 2" />' +
    '<path d="M12 6.5v13" />',
  // Posizione: un foglio di testo.
  //
  // E' la terza versione di questa icona, e le prime due sbagliavano per motivi
  // opposti. Era una scacchiera coi pezzi sparsi, pensata per leggersi in coppia con
  // quella schierata di "nuova partita": troppo simile, ed e' costata a un utente una
  // partita intera. Poi due frecce opposte: inconfondibili ma vaghe, dicevano
  // "scambio" e basta.
  //
  // Un foglio con delle righe dice la cosa vera e letterale: quel menu fa entrare e
  // uscire del TESTO, perche' un PGN e un FEN sono testo. Non somiglia a nessun'altra
  // icona della barra, e non ha bisogno di essere interpretato.
  //
  // L'angolo ripiegato non e' decorazione: e' cio' che distingue un foglio da un
  // rettangolo con dentro delle righe.
  position:
    '<path d="M6 3h7.5L19 8.5V21H6z" />' +
    '<path d="M13.5 3v5.5H19" />' +
    '<path d="M9 12.5h7M9 16h7M9 9h2.5" />',
};

export function createIcon(name: IconName): SVGSVGElement {
  return svgWith(PATHS[name]);
}

/**
 * Il bilanciere caricato secondo il livello: piu' dischi, piu' forte la Nonna.
 *
 * Idea dell'autore, al posto di un numero nell'angolo: il numero esatto si legge
 * toccando l'icona, e quello che serve a colpo d'occhio e' la TENDENZA — scarico o
 * carico — che un peso dice senza parole e in qualunque lingua. Provato a grandezza
 * reale: 1 e 5 si distinguono subito, 3 e 4 meno, ed e' un prezzo accettabile.
 *
 * Dall'interno verso l'esterno, per lato: 1 un disco piccolo, 2 due piccoli, 3 grande
 * e piccolo, 4 due grandi, 5 due grandi e uno piccolo. Il 2 era un disco grande solo:
 * due piccoli si leggono meglio come "un gradino sopra l'1" (proposta dell'autore).
 */
const PLATES: readonly (readonly ('big' | 'small')[])[] = [
  ['small'],
  ['small', 'small'],
  ['big', 'small'],
  ['big', 'big'],
  ['big', 'big', 'small'],
];
const PLATE_X = [7, 4.5, 2];

export function createStrengthIcon(level: number): SVGSVGElement {
  const plates = PLATES[Math.min(PLATES.length, Math.max(1, level)) - 1] ?? PLATES[0]!;
  let d = 'M7 12h10';
  plates.forEach((kind, index) => {
    const [top, bottom] = kind === 'big' ? [7, 17] : [9.5, 14.5];
    const x = PLATE_X[index]!;
    d += `M${x} ${top}V${bottom}M${24 - x} ${top}V${bottom}`;
  });
  return svgWith(`<path d="${d}" />`);
}

function svgWith(inner: string): SVGSVGElement {
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
  svg.innerHTML = inner;
  return svg;
}
