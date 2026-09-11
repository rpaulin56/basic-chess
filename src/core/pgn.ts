import { Chess } from 'chess.js';
import { gameOver, goTo, newGame, playMove, INITIAL_FEN, type GameState } from './game.js';

/**
 * Import/export PGN.
 *
 * L'import lo delega a chess.js (che gestisce tag, commenti, varianti scartate, NAG)
 * e poi RICOSTRUISCE il nostro stato immutabile rigiocando le mosse: cosi' ogni Ply ha
 * il suo fenBefore/fenAfter come se la partita fosse stata giocata qui, e il tutor puo'
 * analizzare una partita importata esattamente come una giocata.
 *
 * L'export invece se lo scrive da solo. Non e' orgoglio: chess.js emette il movetext
 * dalla sua storia interna e non permette di attaccare a una mossa il suffisso "?" o
 * "??", che e' proprio quello che serve per far vedere gli errori a chi apre il file
 * con un altro programma.
 */

export interface PgnTags {
  readonly [tag: string]: string;
}

export interface ParsedPgn {
  readonly state: GameState;
  readonly tags: PgnTags;
  /** I commenti trovati, per indice di semi-mossa. Vedi ANNOTATION_TAG. */
  readonly comments: ReadonlyMap<number, string>;
}

/**
 * Marcatore delle nostre annotazioni dentro un commento PGN.
 *
 * La sintassi `[%nome valore]` dentro le graffe e' la convenzione di fatto per i dati
 * strutturati nei PGN (Lichess ci mette `[%eval ...]` e `[%clk ...]`, ChessBase altre):
 * i programmi che non la conoscono la ignorano e la conservano, quindi un PGN
 * annotato da noi resta leggibile ovunque e torna intatto se ci rientra.
 *
 * Il commento contiene SOLO il marcatore, senza prosa. Quella c'era, ed era un errore:
 * i suffissi "?" e "??" erano nati per accorciare il PGN e si erano ritrovati sopra a
 * una frase che ripeteva la stessa cosa a parole. Cio' che un lettore umano deve
 * cogliere a colpo d'occhio sta gia' sulla mossa.
 *
 * Campi, separati da virgola e in quest'ordine:
 *   category   oversight | tactical | strategic   (vuoto se non classificato)
 *   drop       punti di aspettativa persi, intero
 *   state      kept | undone
 *   san        solo se `undone`: la mossa ritirata, che nella partita non c'e' piu'
 *
 * La GRAVITA' non c'e', ed e' deliberato: la dice gia' il suffisso sulla mossa, ed e'
 * comunque una funzione dello scarto. Nel marcatore sta solo cio' che non si ricava da
 * altro — scrivere due volte lo stesso dato e' il modo piu' sicuro di ritrovarselo
 * incoerente.
 */
export const ANNOTATION_TAG = '%bc';

/**
 * Marcatore di un ripensamento, sulla mossa giocata al posto di un'altra:
 * `[%bcr mossa-ripresa,costo]`, con il costo vuoto se non si conosce.
 *
 * Distinto da `%bc` perche' un ripensamento non e' un errore segnalato: letto come tale
 * finirebbe fra gli errori del riepilogo. E non ne e' un prefisso che confonda i lettori:
 * `[%bc ` vuole uno spazio dopo `%bc`, e qui dopo c'e' una `r`.
 */
export const RETHINK_TAG = '%bcr';

/**
 * Il suffisso da appendere alla mossa, per gravita'.
 *
 * Lo standard PGN li prevede (`!` `?` `!!` `??` `!?` `?!`) come equivalenti dei NAG
 * da $1 a $6, con una sfumatura che vale la pena conoscere: l'"import format" accetta
 * i suffissi, l'"export format" vorrebbe i NAG. Scriviamo i suffissi lo stesso perche'
 * un PGN si legge anche a occhio, e "Bg3??" dice qualcosa a chiunque mentre "$4" no.
 * Tutti i programmi diffusi li rileggono senza storcere il naso — verificato anche su
 * chess.js, che li accetta e li scarta (a noi non serve rileggerli: il dato vero sta
 * nel marcatore [%bc]).
 */
export const SEVERITY_SUFFIX: Record<string, string> = {
  blunder: '??',
  mistake: '?',
  inaccuracy: '?!',
};

/**
 * Il tempo impiegato per una mossa, come comando `[%emt h:mm:ss]` dentro un commento.
 *
 * `%emt` ("elapsed move time") viene dalla stessa estensione dei commenti che porta
 * `%clk`, ed e' quella giusta per noi: `%clk` dice quanto tempo RESTA sull'orologio, e
 * l'orologio non c'e'; noi sappiamo quanto tempo si e' USATO. Secondi interi: per chi
 * comincia le mosse durano secondi, e i decimali sono la parte meno condivisa della
 * convenzione.
 */
export function formatEmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `[%emt ${hours}:${minutes}:${seconds}]`;
}

/**
 * Il tempo di un `[%emt ...]` in millisecondi, o null se il commento non ne ha.
 *
 * Spazi qualunque, anche un a capo: l'export spezza i commenti lunghi sugli spazi (vedi
 * `wrap`). E i decimali si accettano, perche' qualche altro programma li scrive.
 */
export function readEmt(comment: string): number | null {
  const match = comment.match(/\[%emt\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\s*\]/);
  if (!match) return null;
  return Math.round((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000);
}

export function parsePgn(pgn: string): ParsedPgn {
  const chess = new Chess();
  chess.loadPgn(pgn); // lancia se il PGN e' malformato: lo gestisce il chiamante
  const tags = chess.getHeaders() as PgnTags;

  // I commenti sono indicizzati per FEN: li riportiamo su indici di semi-mossa
  // ricostruendo le posizioni, cosi' chi li usa non deve sapere come sono fatti.
  const byFen = new Map<string, string>();
  for (const entry of chess.getComments()) byFen.set(entry.fen, entry.comment);

  // Il tag FEN indica una posizione di partenza diversa da quella iniziale.
  const startFen = typeof tags['FEN'] === 'string' && tags['FEN'] ? tags['FEN'] : INITIAL_FEN;

  const comments = new Map<number, string>();
  let state = newGame(startFen);
  for (const move of chess.history({ verbose: true })) {
    const next = playMove(
      state,
      move.from,
      move.to,
      move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    );
    if (!next) throw new Error(`Mossa non rigiocabile durante l'import: ${move.san}`);
    state = next;
    const comment = byFen.get(move.after);
    if (comment) comments.set(state.plies.length - 1, comment);
  }
  return { state, tags, comments };
}

/** Quel che si puo' attaccare a una semi-mossa nell'export. */
export interface Annotation {
  /** Commento fra graffe, gia' in inglese e gia' composto. */
  readonly comment?: string;
  /** Suffisso da appendere alla mossa: "??", "?", "?!". */
  readonly suffix?: string;
}

/**
 * I sette tag obbligatori, nell'ordine imposto dallo standard (Seven Tag Roster).
 * L'ordine non e' estetica: un PGN con i sette tag fuori sequenza e' formalmente
 * scorretto, e qualche importatore vecchio si offende.
 */
const SEVEN_TAG_ROSTER = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];

/**
 * Esporta il PGN. Esporta la partita INTERA, non solo fino al cursore: il cursore e'
 * una posizione di lettura, non un troncamento della partita (per troncare davvero
 * c'e' truncateHere).
 */
export function toPgn(
  state: GameState,
  tags: PgnTags = {},
  annotations: ReadonlyMap<number, Annotation> = new Map(),
): string {
  const today = new Date();
  const date = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const headers: Record<string, string> = {
    Event: 'GrandmaChess',
    Site: '?',
    Date: date,
    Round: '?',
    White: '?',
    Black: '?',
    // Result calcolato dalla posizione finale: un PGN esportato con "*" su una partita
    // gia' conclusa viene riletto come partita interrotta da qualunque altro programma.
    Result: resultOf(state),
    ...tags,
  };
  if (state.startFen !== INITIAL_FEN) {
    headers['SetUp'] = '1';
    headers['FEN'] = state.startFen;
  }

  const lines: string[] = [];
  for (const tag of SEVEN_TAG_ROSTER) lines.push(`[${tag} "${escapeTag(headers[tag] ?? '?')}"]`);
  for (const [tag, value] of Object.entries(headers)) {
    if (!SEVEN_TAG_ROSTER.includes(tag)) lines.push(`[${tag} "${escapeTag(value)}"]`);
  }

  return `${lines.join('\n')}\n\n${movetext(state, headers['Result'] ?? '*', annotations)}\n`;
}

/** Le virgolette dentro un tag vanno protette, o il PGN si spezza. */
function escapeTag(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function movetext(
  state: GameState,
  result: string,
  annotations: ReadonlyMap<number, Annotation>,
): string {
  const startNumber = Number(state.startFen.split(' ')[5] ?? '1') || 1;
  const startsBlack = state.startFen.split(' ')[1] === 'b';
  const tokens: string[] = [];
  let commented = false;

  state.plies.forEach((ply, index) => {
    const moveNumber = startNumber + Math.floor((index + (startsBlack ? 1 : 0)) / 2);
    const isWhite = ply.color === 'w';
    // Il numero davanti alla mossa del Nero serve quando il Nero apre la sequenza o
    // quando un commento ha interrotto il filo: senza, un lettore rigoroso non sa piu'
    // a che mossa e' arrivato.
    if (isWhite) tokens.push(`${moveNumber}.`);
    else if (index === 0 || commented) tokens.push(`${moveNumber}...`);

    const annotation = annotations.get(index);
    tokens.push(`${ply.san}${annotation?.suffix ?? ''}`);
    if (annotation?.comment) {
      // Le graffe non possono comparire dentro un commento PGN: annidarle non e'
      // previsto dallo standard e i lettori si perdono.
      tokens.push(`{${annotation.comment.replace(/[{}]/g, '')}}`);
    }
    commented = Boolean(annotation?.comment);
  });

  tokens.push(result);
  return wrap(tokens, 80);
}

/**
 * Va a capo prima degli 80 caratteri, come vuole l'export format. Non e' pedanteria
 * inutile: un movetext su una riga sola di duemila caratteri e' illeggibile in un
 * editor e qualche strumento a righe lo tronca.
 */
function wrap(tokens: readonly string[], width: number): string {
  const lines: string[] = [];
  let current = '';
  const push = (piece: string): void => {
    if (current === '') current = piece;
    else if (current.length + 1 + piece.length <= width) current += ` ${piece}`;
    else {
      lines.push(current);
      current = piece;
    }
  };
  for (const token of tokens) {
    // Un commento piu' lungo di una riga si spezza sugli spazi: dentro le graffe gli
    // a capo non contano, quindi il commento resta lo stesso e la riga rientra nei
    // limiti. Una mossa invece non si spezza mai, e non arriva mai a ottanta
    // caratteri, quindi il caso non si pone.
    if (token.length > width && token.startsWith('{')) {
      for (const word of token.split(' ')) push(word);
    } else {
      push(token);
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

function resultOf(state: GameState): string {
  const over = gameOver(goTo(state, state.plies.length));
  if (!over) return '*';
  if (over.winner === 'w') return '1-0';
  if (over.winner === 'b') return '0-1';
  return '1/2-1/2';
}
