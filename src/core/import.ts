import { newGame, type GameState } from './game.js';
import { parsePgn, type PgnTags } from './pgn.js';

/**
 * Ingresso unico per "carica una posizione o una partita".
 *
 * Motivo di avere UNA funzione invece di due comandi separati: le raccolte di finali
 * circolano in entrambe le forme — PGN con tag FEN+SetUp (studi Lichess: posizione
 * PIU' soluzione) e FEN nudi una riga per posizione (raccolte classiche, export di
 * database di problemi) — e chiedere all'utente di sapere in anticipo quale delle due
 * ha in mano e' una domanda a cui il programma sa rispondere da solo.
 */

export type ImportKind = 'fen' | 'pgn';

export interface ImportResult {
  readonly state: GameState;
  readonly tags: PgnTags;
  readonly kind: ImportKind;
  /** Commenti del PGN per indice di semi-mossa; vuoto per un FEN. */
  readonly comments: ReadonlyMap<number, string>;
}

/**
 * Un FEN e' una riga sola con 4-6 campi separati da spazi, il primo dei quali e' la
 * disposizione dei pezzi: 8 gruppi separati da "/" di cifre e lettere di pezzo.
 * E' un test volutamente lasco (validare davvero il FEN tocca a chess.js, che lancia
 * con un messaggio utile): serve solo a DISTINGUERLO da un PGN, e un PGN non inizia
 * mai con qualcosa che assomigli a questo.
 */
const FEN_BOARD = /^([1-8pnbrqkPNBRQK]+\/){7}[1-8pnbrqkPNBRQK]+$/;

export function looksLikeFen(text: string): boolean {
  const fields = text.trim().split(/\s+/);
  return fields.length >= 2 && fields.length <= 6 && FEN_BOARD.test(fields[0]!);
}

/**
 * Completa un FEN abbreviato. Le raccolte di posizioni omettono spesso gli ultimi due
 * campi (semimosse dalla 50-mosse e numero di mossa), che chess.js invece pretende:
 * senza questo, meta' delle librerie di finali reperibili in rete verrebbe rifiutata
 * per un dettaglio che non cambia nulla nella posizione.
 */
export function completeFen(text: string): string {
  const fields = text.trim().split(/\s+/);
  if (fields.length >= 6) return fields.slice(0, 6).join(' ');
  const [board, turn = 'w', castling = '-', enPassant = '-', halfmove = '0'] = fields;
  return [board, turn, castling, enPassant, halfmove, '1'].join(' ');
}

/**
 * Riconosce da solo se il testo e' un FEN o un PGN e restituisce lo stato di partenza.
 * Lancia con un messaggio leggibile se il testo non e' ne' l'uno ne' l'altro.
 */
export function parseGameInput(text: string): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Testo vuoto');

  if (looksLikeFen(trimmed)) {
    const fen = completeFen(trimmed);
    return { state: newGame(fen), tags: { FEN: fen, SetUp: '1' }, kind: 'fen', comments: new Map() };
  }

  const parsed = parsePgn(trimmed);
  return { state: parsed.state, tags: parsed.tags, kind: 'pgn', comments: parsed.comments };
}
