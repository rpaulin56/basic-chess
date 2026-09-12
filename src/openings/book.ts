/**
 * Il libro di apertura della Nonna: cosa si gioca davvero, e quanto.
 *
 * E' l'altra faccia di openings.ts. Quello dice il NOME di una posizione ("Difesa
 * Siciliana"), questo dice le MOSSE che da li' si giocano e la loro frequenza fra i
 * giocatori della fascia 1200-1800. Servono due cose diverse: un nome non dice cosa
 * giocare, e una frequenza non ha un nome.
 *
 * Nasce da un difetto visto giocando: senza libro la Nonna sceglieva fra le prime mosse
 * del motore con molta casualita', e apriva con 1.a3 o 1.f3 — mosse che il motore non
 * punisce e che nessuno gioca. "Non perdente" e "teorico" non sono la stessa cosa.
 *
 * Il file (vedi tools/build-book.mjs) e' servito dalla nostra origine e si carica una
 * volta sola, alla prima domanda: chi apre il programma per rivedere un finale non lo
 * scarica nemmeno.
 */

/** Una mossa del libro, con quanto e' giocata in quella posizione (in percento). */
export interface BookMove {
  readonly san: string;
  readonly share: number;
}

/** Versione del FORMATO, per invalidare la cache dei browser. Vedi openings.ts. */
const FORMAT = 1;

type Table = Record<string, [string, number][]>;

let table: Table | null = null;
let loading: Promise<Table> | null = null;

async function load(): Promise<Table> {
  const response = await fetch(`/book.json?v=${FORMAT}`);
  if (!response.ok) throw new Error(`book.json: HTTP ${response.status}`);
  return (await response.json()) as Table;
}

/**
 * Vero se il libro e' in mano: serve a distinguere "fuori teoria" da "libro non
 * caricato". Sono due cose diverse, e trattarle allo stesso modo spegneva la modalita'
 * studio per un file arrivato un istante tardi.
 */
export function bookLoaded(): boolean {
  return table !== null;
}

/** Chiave di posizione: disposizione, tratto, arrocchi. La stessa del generatore. */
function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 3).join(' ');
}

/**
 * Le mosse di libro in questa posizione, dalla piu' giocata alla meno giocata.
 *
 * Vuoto se la posizione non e' nel libro, che e' anche il modo in cui si sa di essere
 * usciti dalla teoria. Se il file non si carica si risponde vuoto invece di fermare il
 * gioco: senza libro la Nonna gioca come prima.
 */
export async function bookMoves(fen: string): Promise<readonly BookMove[]> {
  try {
    table ??= await (loading ??= load());
  } catch {
    // Il tentativo fallito NON si tiene: `loading` conserverebbe una promessa gia'
    // rifiutata e ogni chiamata successiva ricadrebbe su quella, quindi un intoppo di un
    // istante spegnerebbe il libro per tutta la sessione. Visto davvero, con il file
    // riscritto dal generatore mentre la pagina lo leggeva.
    loading = null;
    return [];
  }
  const entry = table[positionKey(fen)];
  if (!entry) return [];
  return entry
    .map(([san, share]) => ({ san, share }))
    .sort((a, b) => b.share - a.share);
}

/**
 * Sorteggia una mossa del libro, con probabilita' proporzionale a quanto e' giocata.
 *
 * Non si prende SEMPRE la piu' giocata: la Nonna aprirebbe 1.e4 per tutta la vita, e chi
 * gioca non vedrebbe mai nient'altro. Cosi' invece esce e4 due volte su tre, d4 una su
 * quattro, e ogni tanto qualcosa di piu' raro — che e' esattamente la distribuzione di
 * quello che si trova giocando con altri.
 */
export function chooseFromBook(moves: readonly BookMove[], random: number): BookMove | null {
  const total = moves.reduce((sum, move) => sum + Math.max(0, move.share), 0);
  if (total <= 0) return null;
  let ticket = Math.min(Math.max(random, 0), 0.999999) * total;
  for (const move of moves) {
    ticket -= Math.max(0, move.share);
    if (ticket < 0) return move;
  }
  return moves[moves.length - 1] ?? null;
}

/**
 * Quante frecce disegnare, deciso dalla DISTRIBUZIONE e non da un numero fisso.
 *
 * Si prendono le mosse piu' giocate finche' la somma delle loro quote arriva alla soglia:
 * dove la teoria si dirama si vede il ventaglio, dove c'e' una mossa sola si vede una
 * freccia sola — e anche quello e' un'informazione, delle piu' utili.
 *
 * La soglia e' GENEROSA all'inizio e cala di due punti a ogni semi-mossa, fino all'85%.
 * Con l'85% fisso, alla prima mossa sarebbero rimaste e4 e d4 (87% in due) e sarebbero
 * sparite Inglese e Réti, che sono proprio le cose che uno vuole vedere quando guarda il
 * menu delle aperture. Piu' si scende, piu' i rami si moltiplicano e piu' conviene
 * stringere sulle principali.
 *
 * Il libro conserva al massimo sei mosse per posizione, quindi sei e' anche il tetto.
 */
export function arrowMoves(moves: readonly BookMove[], ply: number): readonly BookMove[] {
  const threshold = Math.max(85, 95 - 2 * ply);
  const chosen: BookMove[] = [];
  let sum = 0;
  for (const move of moves) {
    chosen.push(move);
    sum += move.share;
    if (sum >= threshold) break;
  }
  return chosen;
}

/**
 * Il pennello di una freccia, dalla quota: quattro spessori bastano a far vedere la
 * proporzione, e piu' gradini non si distinguerebbero comunque a occhio.
 */
export function brushFor(share: number): string {
  if (share >= 45) return 'book4';
  if (share >= 25) return 'book3';
  if (share >= 10) return 'book2';
  return 'book1';
}
